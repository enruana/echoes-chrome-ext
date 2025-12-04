import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  Recording,
  getRecordings,
  deleteRecording,
  updateRecording,
  formatFileSize,
  formatDuration,
  saveRecording,
} from '../utils/storage'
import './Recordings.css'

const API_URL = 'http://127.0.0.1:8765'

const SUPPORTED_AUDIO_TYPES = [
  'audio/webm',
  'audio/mp3',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/flac',
  'audio/m4a',
  'audio/x-m4a',
  'audio/mp4',
]

export const Recordings = () => {
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [loading, setLoading] = useState(true)
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadRecordings()
    checkApiHealth()
  }, [])

  const loadRecordings = async () => {
    try {
      const recs = await getRecordings()
      setRecordings(recs)
    } catch (err) {
      console.error('Failed to load recordings:', err)
    } finally {
      setLoading(false)
    }
  }

  const checkApiHealth = async () => {
    try {
      const response = await fetch(`${API_URL}/health`, { method: 'GET' })
      const data = await response.json()
      setApiAvailable(data.status === 'ok' && data.model_loaded)
    } catch {
      setApiAvailable(false)
    }
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setImporting(true)

    for (const file of Array.from(files)) {
      if (!SUPPORTED_AUDIO_TYPES.includes(file.type) && !file.name.match(/\.(webm|mp3|wav|ogg|flac|m4a|mp4)$/i)) {
        console.warn(`Skipping unsupported file: ${file.name}`)
        continue
      }

      try {
        // Get audio duration using Audio element
        const duration = await getAudioDuration(file)
        const recording = await saveRecording(file, duration, file.name.replace(/\.[^/.]+$/, ''))
        setRecordings(prev => [recording, ...prev])
      } catch (err) {
        console.error(`Failed to import ${file.name}:`, err)
      }
    }

    setImporting(false)
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const getAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const audio = new Audio()
      audio.onloadedmetadata = () => {
        resolve(Math.floor(audio.duration))
      }
      audio.onerror = () => {
        resolve(0) // Default to 0 if can't read duration
      }
      audio.src = URL.createObjectURL(file)
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this recording?')) return
    try {
      await deleteRecording(id)
      setRecordings(recordings.filter(r => r.id !== id))
      if (selectedRecording?.id === id) {
        setSelectedRecording(null)
      }
    } catch (err) {
      console.error('Failed to delete recording:', err)
    }
  }

  const handleProcess = async (recording: Recording) => {
    if (!apiAvailable) {
      alert('Transcription server is not available. Please start Echoes Server.')
      return
    }

    setProcessingId(recording.id)
    await updateRecording(recording.id, { transcriptionStatus: 'processing' })

    try {
      const formData = new FormData()
      formData.append('file', recording.blob, `${recording.name}.webm`)

      const response = await fetch(`${API_URL}/transcribe?format=markdown`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.statusText}`)
      }

      const markdown = await response.text()
      await updateRecording(recording.id, {
        transcription: markdown,
        transcriptionStatus: 'completed',
      })

      setRecordings(prev =>
        prev.map(r =>
          r.id === recording.id
            ? { ...r, transcription: markdown, transcriptionStatus: 'completed' }
            : r
        )
      )

      if (selectedRecording?.id === recording.id) {
        setSelectedRecording({ ...recording, transcription: markdown, transcriptionStatus: 'completed' })
      }
    } catch (err) {
      console.error('Transcription error:', err)
      await updateRecording(recording.id, { transcriptionStatus: 'error' })
      setRecordings(prev =>
        prev.map(r =>
          r.id === recording.id ? { ...r, transcriptionStatus: 'error' } : r
        )
      )
    } finally {
      setProcessingId(null)
    }
  }

  const handleDownload = (recording: Recording) => {
    const url = URL.createObjectURL(recording.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${recording.name}.webm`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadTranscript = (recording: Recording) => {
    if (!recording.transcription) return
    const blob = new Blob([recording.transcription], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${recording.name}-transcript.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="recordings-page">
        <div className="loading">Loading recordings...</div>
      </div>
    )
  }

  return (
    <div className="recordings-page">
      <header className="page-header">
        <h1>Echoes Recordings</h1>
        <div className="header-actions">
          <button
            onClick={handleImportClick}
            disabled={importing}
            className="btn btn-primary"
          >
            {importing ? 'Importing...' : '+ Import Audio'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.webm,.mp3,.wav,.ogg,.flac,.m4a,.mp4"
            multiple
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <div className="api-status">
            <span className={`status-dot ${apiAvailable ? 'online' : 'offline'}`}></span>
            <span>{apiAvailable ? 'Server Online' : 'Server Offline'}</span>
            <button onClick={checkApiHealth} className="btn-refresh" title="Refresh status">
              ↻
            </button>
          </div>
        </div>
      </header>

      <div className="content-layout">
        <div className="recordings-list">
          {recordings.length === 0 ? (
            <div className="empty-state">
              <p>No recordings yet</p>
              <p className="hint">Record a meeting to get started</p>
            </div>
          ) : (
            recordings.map(recording => (
              <div
                key={recording.id}
                className={`recording-card ${selectedRecording?.id === recording.id ? 'selected' : ''}`}
                onClick={() => setSelectedRecording(recording)}
              >
                <div className="recording-info">
                  <h3>{recording.name}</h3>
                  <div className="recording-meta">
                    <span>{formatDuration(recording.duration)}</span>
                    <span>{formatFileSize(recording.size)}</span>
                    <span>{formatDate(recording.createdAt)}</span>
                  </div>
                  <div className={`status-badge status-${recording.transcriptionStatus || 'pending'}`}>
                    {recording.transcriptionStatus === 'completed' && 'Transcribed'}
                    {recording.transcriptionStatus === 'processing' && 'Processing...'}
                    {recording.transcriptionStatus === 'error' && 'Error'}
                    {(!recording.transcriptionStatus || recording.transcriptionStatus === 'pending') && 'Not transcribed'}
                  </div>
                </div>
                <div className="recording-actions">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleProcess(recording) }}
                    disabled={processingId === recording.id || recording.transcriptionStatus === 'processing'}
                    className="btn btn-primary"
                    title={!apiAvailable ? 'Server offline' : 'Transcribe'}
                  >
                    {processingId === recording.id ? '...' : '▶'}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDownload(recording) }}
                    className="btn btn-secondary"
                    title="Download audio"
                  >
                    ↓
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(recording.id) }}
                    className="btn btn-danger"
                    title="Delete"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="detail-panel">
          {selectedRecording ? (
            <>
              <div className="detail-header">
                <h2>{selectedRecording.name}</h2>
                {selectedRecording.transcription && (
                  <button
                    onClick={() => handleDownloadTranscript(selectedRecording)}
                    className="btn btn-secondary"
                  >
                    Download Transcript
                  </button>
                )}
              </div>
              {selectedRecording.transcription ? (
                <div className="transcript-content markdown-body">
                  <ReactMarkdown>{selectedRecording.transcription}</ReactMarkdown>
                </div>
              ) : (
                <div className="no-transcript">
                  <p>No transcription available</p>
                  {apiAvailable ? (
                    <button
                      onClick={() => handleProcess(selectedRecording)}
                      disabled={processingId === selectedRecording.id}
                      className="btn btn-primary"
                    >
                      {processingId === selectedRecording.id ? 'Processing...' : 'Transcribe Now'}
                    </button>
                  ) : (
                    <p className="hint">Start Echoes Server to transcribe</p>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="no-selection">
              <p>Select a recording to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Recordings
