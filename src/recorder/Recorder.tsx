import { useState, useRef, useEffect } from 'react'
import { saveRecording } from '../utils/storage'

type CaptureMode = 'tab' | 'mic' | 'both'

interface RecorderParams {
  mode: CaptureMode
  deviceId: string
  tabId: number
}

const NUM_BARS = 5

export const Recorder = () => {
  const [status, setStatus] = useState<'starting' | 'recording' | 'stopped'>('starting')
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(NUM_BARS).fill(0))

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)

  // Get params from URL
  const getParams = (): RecorderParams | null => {
    const params = new URLSearchParams(window.location.search)
    const mode = params.get('mode') as CaptureMode
    const deviceId = params.get('deviceId') || ''
    const tabId = parseInt(params.get('tabId') || '0', 10)

    if (!mode || !tabId) return null
    return { mode, deviceId, tabId }
  }

  // Start recording on mount
  useEffect(() => {
    const params = getParams()
    if (!params) {
      setError('Invalid parameters')
      return
    }
    startRecording(params)
  }, [])

  // Update duration while recording
  useEffect(() => {
    if (status !== 'recording') return
    const interval = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [status])

  // Audio visualization
  const updateAudioLevels = () => {
    if (!analyserRef.current) return

    const analyser = analyserRef.current
    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteFrequencyData(dataArray)

    // Sample frequencies across the spectrum for each bar
    const levels: number[] = []
    const step = Math.floor(dataArray.length / NUM_BARS)

    for (let i = 0; i < NUM_BARS; i++) {
      const start = i * step
      const end = start + step
      let sum = 0
      for (let j = start; j < end; j++) {
        sum += dataArray[j]
      }
      const avg = sum / step
      // Normalize to 0-1 range with some smoothing
      levels.push(Math.min(1, avg / 180))
    }

    setAudioLevels(levels)
    animationRef.current = requestAnimationFrame(updateAudioLevels)
  }

  const setupAnalyser = (audioContext: AudioContext, source: AudioNode) => {
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.7
    source.connect(analyser)
    analyserRef.current = analyser
    updateAudioLevels()
  }

  const startRecording = async (params: RecorderParams) => {
    try {
      let finalStream: MediaStream

      if (params.mode === 'tab' || params.mode === 'both') {
        // Get stream ID for the specific tab
        const streamId = await chrome.tabCapture.getMediaStreamId({
          targetTabId: params.tabId,
        })

        // Use getUserMedia with the stream ID to capture the tab
        const tabStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            // @ts-ignore - Chrome-specific constraints
            mandatory: {
              chromeMediaSource: 'tab',
              chromeMediaSourceId: streamId,
            },
          },
          video: {
            // @ts-ignore - Need video for proper tab capture
            mandatory: {
              chromeMediaSource: 'tab',
              chromeMediaSourceId: streamId,
            },
          },
        })

        // Stop video tracks - we only need audio
        tabStream.getVideoTracks().forEach(t => t.stop())

        if (params.mode === 'both' && params.deviceId) {
          // Mix tab audio with microphone
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: params.deviceId } }
          })

          const audioContext = new AudioContext()
          const destination = audioContext.createMediaStreamDestination()

          // Create a merger gain node for visualization
          const merger = audioContext.createGain()

          const tabSource = audioContext.createMediaStreamSource(tabStream)
          const micSource = audioContext.createMediaStreamSource(micStream)

          // Connect sources to merger for visualization
          tabSource.connect(merger)
          micSource.connect(merger)

          // Connect merger to destination and speakers
          merger.connect(destination)
          tabSource.connect(audioContext.destination)

          // Setup analyser on the merger for visualization
          setupAnalyser(audioContext, merger)

          audioContextRef.current = audioContext
          finalStream = destination.stream

          streamRef.current = tabStream
          ;(streamRef as any).micStream = micStream
        } else {
          // Tab only
          const audioContext = new AudioContext()
          const source = audioContext.createMediaStreamSource(tabStream)
          source.connect(audioContext.destination)

          // Setup analyser for visualization
          setupAnalyser(audioContext, source)

          audioContextRef.current = audioContext
          finalStream = tabStream
          streamRef.current = tabStream
        }
      } else {
        // Mic only
        finalStream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: params.deviceId } }
        })

        // Setup analyser for mic
        const audioContext = new AudioContext()
        const source = audioContext.createMediaStreamSource(finalStream)
        setupAnalyser(audioContext, source)
        audioContextRef.current = audioContext

        streamRef.current = finalStream
      }

      chunksRef.current = []

      const mediaRecorder = new MediaRecorder(finalStream, {
        mimeType: 'audio/webm;codecs=opus',
      })

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start(1000)
      startTimeRef.current = Date.now()
      setStatus('recording')

    } catch (err) {
      setError((err as Error).message)
      setStatus('stopped')
    }
  }

  const stopRecording = async () => {
    // Stop animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    analyserRef.current = null
    setAudioLevels(new Array(NUM_BARS).fill(0))

    const mediaRecorder = mediaRecorderRef.current
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      if ((streamRef as any).micStream) {
        (streamRef as any).micStream.getTracks().forEach((t: MediaStreamTrack) => t.stop())
      }
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    // Save recording to IndexedDB
    setTimeout(async () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })

      if (blob.size > 0) {
        try {
          await saveRecording(blob, duration)
          setStatus('stopped')
        } catch (err) {
          setError('Failed to save recording')
          setStatus('stopped')
        }
      } else {
        setStatus('stopped')
      }
    }, 100)
  }

  const openRecordings = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('recordings.html') })
    window.close()
  }

  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div style={{
      padding: 24,
      textAlign: 'center',
      minWidth: 200,
    }}>
      {status === 'starting' && (
        <div style={{ color: '#888' }}>Starting...</div>
      )}

      {status === 'recording' && (
        <>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            marginBottom: 20,
          }}>
            <span style={{
              width: 14,
              height: 14,
              background: '#dc2626',
              borderRadius: '50%',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}></span>
            <span style={{
              fontSize: 36,
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {formatDuration(duration)}
            </span>
          </div>

          {/* Audio visualization bars */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-end',
            gap: 4,
            height: 32,
            marginBottom: 20,
          }}>
            {audioLevels.map((level, i) => (
              <div
                key={i}
                style={{
                  width: 4,
                  height: `${Math.max(4, level * 32)}px`,
                  background: '#6366f1',
                  borderRadius: 2,
                  transition: 'height 0.05s ease-out',
                }}
              />
            ))}
          </div>

          <button
            onClick={stopRecording}
            style={{
              padding: '10px 32px',
              fontSize: 14,
              fontWeight: 500,
              background: '#374151',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Stop Recording
          </button>
        </>
      )}

      {status === 'stopped' && !error && (
        <div>
          <div style={{ color: '#22c55e', marginBottom: 16 }}>Recording saved!</div>
          <button
            onClick={openRecordings}
            style={{
              padding: '10px 24px',
              fontSize: 14,
              fontWeight: 500,
              background: '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            View Recordings
          </button>
        </div>
      )}

      {error && (
        <div style={{ color: '#dc2626' }}>Error: {error}</div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.1); }
        }
      `}</style>
    </div>
  )
}
