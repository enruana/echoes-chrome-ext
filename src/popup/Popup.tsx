import { useState, useEffect } from 'react'
import './Popup.css'

interface AudioDevice {
  deviceId: string
  label: string
}

type CaptureMode = 'tab' | 'mic' | 'both'

type Platform = 'meet' | 'teams' | 'zoom' | null

const SUPPORTED_PATTERNS = [
  { pattern: /^https:\/\/meet\.google\.com\//, name: 'Google Meet', platform: 'meet' as Platform },
  { pattern: /^https:\/\/teams\.microsoft\.com\//, name: 'Microsoft Teams', platform: 'teams' as Platform },
  { pattern: /^https:\/\/teams\.live\.com\//, name: 'Microsoft Teams', platform: 'teams' as Platform },
  { pattern: /^https:\/\/.*\.zoom\.us\//, name: 'Zoom', platform: 'zoom' as Platform },
]

export const Popup = () => {
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([])
  const [selectedDevice, setSelectedDevice] = useState<string>('')
  const [captureMode, setCaptureMode] = useState<CaptureMode>('both')
  const [micPermission, setMicPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown')
  const [isStarting, setIsStarting] = useState(false)
  const [currentPlatform, setCurrentPlatform] = useState<{ name: string; platform: Platform } | null>(null)
  const [isCheckingTab, setIsCheckingTab] = useState(true)

  useEffect(() => {
    checkCurrentTab()
    checkPermissionAndLoadDevices()
  }, [])

  const checkCurrentTab = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.url) {
        const match = SUPPORTED_PATTERNS.find(p => p.pattern.test(tab.url!))
        if (match) {
          setCurrentPlatform({ name: match.name, platform: match.platform })
        }
      }
    } catch (e) {
      console.error('Failed to check tab:', e)
    }
    setIsCheckingTab(false)
  }

  const checkPermissionAndLoadDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioInputs = devices
        .filter(d => d.kind === 'audioinput')
        .map(d => ({ deviceId: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0, 8)}` }))

      if (audioInputs.length > 0 && audioInputs[0].label) {
        setMicPermission('granted')
        setAudioDevices(audioInputs)
        setSelectedDevice(audioInputs[0].deviceId)
      } else {
        try {
          const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
          setMicPermission(result.state === 'granted' ? 'granted' : 'unknown')
        } catch {
          setMicPermission('unknown')
        }
      }
    } catch {
      setMicPermission('unknown')
    }
  }

  const startRecording = async () => {
    setIsStarting(true)

    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab.id) {
        throw new Error('No active tab found')
      }

      // Build URL with parameters
      const params = new URLSearchParams({
        mode: captureMode,
        deviceId: selectedDevice,
        tabId: tab.id.toString(),
      })

      // Open recorder window
      await chrome.windows.create({
        url: `recorder.html?${params.toString()}`,
        type: 'popup',
        width: 300,
        height: 180,
        top: 100,
        left: 100,
        focused: true,
      })

      // Close popup
      window.close()

    } catch (err) {
      console.error('Failed to start recording:', err)
      setIsStarting(false)
    }
  }

  const needsMicPermission = (captureMode === 'mic' || captureMode === 'both') && micPermission !== 'granted'

  // Show loading state
  if (isCheckingTab) {
    return (
      <main className="popup">
        <h1 className="title">Echoes</h1>
        <p className="hint">Loading...</p>
      </main>
    )
  }

  // Show unsupported page message
  if (!currentPlatform) {
    return (
      <main className="popup">
        <h1 className="title">Echoes</h1>
        <div className="unsupported">
          <p>Navigate to a meeting to start recording:</p>
          <ul>
            <li>Google Meet</li>
            <li>Microsoft Teams</li>
            <li>Zoom</li>
          </ul>
        </div>
      </main>
    )
  }

  return (
    <main className="popup">
      <div className="header">
        <h1 className="title">Echoes</h1>
        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          className="settings-btn"
          title="Settings"
        >
          ⚙️
        </button>
      </div>

      <div className="platform-badge">
        {currentPlatform.name}
      </div>

      <div className="form-group">
        <label>Capture Mode</label>
        <select
          value={captureMode}
          onChange={(e) => setCaptureMode(e.target.value as CaptureMode)}
        >
          <option value="tab">Tab Audio Only</option>
          <option value="mic">Microphone Only</option>
          <option value="both">Tab + Microphone</option>
        </select>
      </div>

      {(captureMode === 'mic' || captureMode === 'both') && (
        <div className="form-group">
          {micPermission !== 'granted' ? (
            <button
              onClick={() => chrome.runtime.openOptionsPage()}
              className="btn btn-secondary"
            >
              Setup Microphone
            </button>
          ) : (
            <>
              <label>Microphone</label>
              <select
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
              >
                {audioDevices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                ))}
              </select>
            </>
          )}
        </div>
      )}

      <button
        onClick={startRecording}
        disabled={needsMicPermission || isStarting}
        className="btn btn-record"
      >
        {isStarting ? 'Starting...' : 'Start Recording'}
      </button>

      <p className="hint">
        A small window will open to control the recording
      </p>
    </main>
  )
}

export default Popup
