const DB_NAME = 'echoes-recordings'
const DB_VERSION = 1
const STORE_NAME = 'recordings'

export interface Recording {
  id: string
  name: string
  blob: Blob
  duration: number
  createdAt: number
  size: number
  transcription?: string
  transcriptionStatus?: 'pending' | 'processing' | 'completed' | 'error'
}

let db: IDBDatabase | null = null

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db)
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }
  })
}

export const saveRecording = async (blob: Blob, duration: number, customName?: string): Promise<Recording> => {
  const database = await openDB()
  const id = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

  const recording: Recording = {
    id,
    name: customName || `Recording ${timestamp}`,
    blob,
    duration,
    createdAt: Date.now(),
    size: blob.size,
    transcriptionStatus: 'pending',
  }

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.add(recording)

    request.onsuccess = () => resolve(recording)
    request.onerror = () => reject(request.error)
  })
}

export const getRecordings = async (): Promise<Recording[]> => {
  const database = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('createdAt')
    const request = index.openCursor(null, 'prev')

    const recordings: Recording[] = []
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
      if (cursor) {
        recordings.push(cursor.value)
        cursor.continue()
      } else {
        resolve(recordings)
      }
    }
    request.onerror = () => reject(request.error)
  })
}

export const getRecording = async (id: string): Promise<Recording | null> => {
  const database = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(id)

    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

export const updateRecording = async (id: string, updates: Partial<Recording>): Promise<void> => {
  const database = await openDB()
  const recording = await getRecording(id)
  if (!recording) throw new Error('Recording not found')

  const updated = { ...recording, ...updates }

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.put(updated)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export const deleteRecording = async (id: string): Promise<void> => {
  const database = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(id)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const formatDuration = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}
