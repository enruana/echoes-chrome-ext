import { useState, useRef, useEffect } from 'react'
import { saveRecording } from '../utils/storage'

type CaptureMode = 'tab' | 'mic' | 'both'

interface RecorderParams {
  mode: CaptureMode
  deviceId: string
  tabId: number
}

export const Recorder = () => {
  const [status, setStatus] = useState<'starting' | 'recording' | 'stopped'>('starting')
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
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

          const tabSource = audioContext.createMediaStreamSource(tabStream)
          const micSource = audioContext.createMediaStreamSource(micStream)

          tabSource.connect(destination)
          tabSource.connect(audioContext.destination)
          micSource.connect(destination)

          audioContextRef.current = audioContext
          finalStream = destination.stream

          streamRef.current = tabStream
          ;(streamRef as any).micStream = micStream
        } else {
          // Tab only
          const audioContext = new AudioContext()
          const source = audioContext.createMediaStreamSource(tabStream)
          source.connect(audioContext.destination)
          audioContextRef.current = audioContext
          finalStream = tabStream
          streamRef.current = tabStream
        }
      } else {
        // Mic only
        finalStream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: params.deviceId } }
        })
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
