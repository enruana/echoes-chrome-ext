import { useState, useEffect } from 'react'
import './Options.css'

export const Options = () => {
  const [micPermission, setMicPermission] = useState<'checking' | 'granted' | 'denied' | 'prompt'>('checking')
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])

  const checkPermission = async () => {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
      setMicPermission(result.state as 'granted' | 'denied' | 'prompt')

      if (result.state === 'granted') {
        loadDevices()
      }

      result.onchange = () => {
        setMicPermission(result.state as 'granted' | 'denied' | 'prompt')
        if (result.state === 'granted') {
          loadDevices()
        }
      }
    } catch (e) {
      setMicPermission('prompt')
    }
  }

  const loadDevices = async () => {
    const allDevices = await navigator.mediaDevices.enumerateDevices()
    setDevices(allDevices.filter(d => d.kind === 'audioinput'))
  }

  const requestPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => t.stop())
      setMicPermission('granted')
      await loadDevices()
    } catch (e) {
      setMicPermission('denied')
    }
  }

  useEffect(() => {
    checkPermission()
  }, [])

  return (
    <main style={{ padding: 20, fontFamily: 'system-ui, sans-serif', maxWidth: 500 }}>
      <h2>Echoes - Settings</h2>

      <section style={{ marginTop: 20 }}>
        <h3>Microphone Permission</h3>

        {micPermission === 'checking' && <p>Checking permission status...</p>}

        {micPermission === 'granted' && (
          <div>
            <p style={{ color: 'green' }}>✓ Microphone permission granted</p>
            <h4>Available Audio Devices:</h4>
            <ul>
              {devices.map(d => (
                <li key={d.deviceId}>{d.label}</li>
              ))}
            </ul>
            <p style={{ fontSize: 14, color: '#666' }}>
              You can now close this page and use the extension popup to record.
            </p>
          </div>
        )}

        {micPermission === 'denied' && (
          <div>
            <p style={{ color: 'red' }}>✗ Microphone permission denied</p>
            <p>Please enable microphone access in your browser settings:</p>
            <ol>
              <li>Click the lock icon in the address bar</li>
              <li>Find "Microphone" and set it to "Allow"</li>
              <li>Reload this page</li>
            </ol>
          </div>
        )}

        {micPermission === 'prompt' && (
          <div>
            <p>Microphone permission is required to record audio from meetings.</p>
            <button
              onClick={requestPermission}
              style={{
                padding: '12px 24px',
                fontSize: 16,
                background: '#1976d2',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer'
              }}
            >
              Grant Microphone Permission
            </button>
          </div>
        )}
      </section>
    </main>
  )
}

export default Options
