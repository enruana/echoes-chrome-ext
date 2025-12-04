# Fork Summary: ai-processing-audio

**Date:** 2025-12-04
**Branch:** ai-processing-audio
**Status:** Completed Successfully

---

## Executive Summary

### What was attempted to achieve
Create a local Python server that uses OpenAI's Whisper model (via faster-whisper) to transcribe audio recordings captured by the Echoes Chrome extension. The goal was to provide offline, privacy-preserving transcription capabilities without relying on external APIs.

### Why this exploration branch was created
The Echoes Chrome extension successfully captures audio from meetings (Google Meet, Teams, Zoom), but the recordings needed to be transcribed to provide value. Several options were evaluated:
1. **OpenAI Whisper API** - Requires internet, costs money, privacy concerns
2. **WASM/Browser-based** - Limited by browser resources, slow for long recordings
3. **Local Python server** - Offline, free, private, leverages local hardware
4. **Third-party services** - Privacy concerns, subscription costs

The local Python server approach was chosen for its balance of privacy, performance, and cost-effectiveness.

---

## Changes Made

### New Project Created: `echoes-server`

**Location:** `/Users/andres.mantilla/Desktop/Me/software-engineering/echoes-server`

### Project Structure
```
echoes-server/
├── requirements.txt          # Python dependencies
├── setup.py                  # Package installation config
├── echoes-server.spec        # PyInstaller configuration
├── scripts/
│   └── build.sh              # Build script for standalone app
├── assets/                   # Icons and resources
└── src/
    └── echoes_server/
        ├── __init__.py       # Package init with version
        ├── __main__.py       # Module entry point
        ├── config.py         # Configuration settings
        ├── main.py           # Main entry point
        ├── server.py         # FastAPI server
        ├── transcription.py  # Whisper transcription service
        └── tray.py           # System tray functionality
```

### Files Created

#### 1. `requirements.txt`
```
fastapi>=0.109.0
uvicorn>=0.27.0
faster-whisper>=1.2.0
python-multipart>=0.0.6
pystray>=0.19.5
Pillow>=10.2.0
```

#### 2. `src/echoes_server/config.py`
- Server settings (HOST: 127.0.0.1, PORT: 8765)
- Whisper model configuration (MODEL_SIZE, DEVICE, COMPUTE_TYPE)
- Environment variable support for customization
- CORS settings for Chrome extension

#### 3. `src/echoes_server/transcription.py`
- Singleton `TranscriptionService` class
- Uses faster-whisper for efficient transcription
- Supports multiple audio formats (WebM, WAV, MP3, etc.)
- VAD filter to eliminate silence
- Returns structured JSON with segments, timestamps, and language detection

#### 4. `src/echoes_server/server.py`
- FastAPI application with CORS middleware
- **Endpoints:**
  - `GET /` - Health check with service info
  - `GET /health` - Model status check
  - `POST /transcribe` - Audio transcription endpoint
- Async model loading on startup

#### 5. `src/echoes_server/tray.py`
- System tray icon using pystray
- Menu with status display and quit option
- macOS compatibility (main thread requirement)

#### 6. `src/echoes_server/main.py`
- Main entry point coordinating server and tray
- Platform-specific handling for macOS (tray on main thread, server in background)
- Signal handling for graceful shutdown

#### 7. `echoes-server.spec`
- PyInstaller configuration for standalone app
- macOS app bundle support
- Hidden imports for uvicorn and ctranslate2

#### 8. `setup.py`
- Package configuration for pip installation
- Console script entry point: `echoes-server`

### Technical Decisions

1. **faster-whisper over openai-whisper**: 4x faster inference with CTranslate2 backend
2. **FastAPI over Flask**: Modern async support, automatic OpenAPI docs
3. **Singleton pattern for model**: Avoid reloading heavy model on each request
4. **Temp file approach**: faster-whisper requires file path, not byte streams
5. **VAD filter enabled**: Automatically skip silence for cleaner transcripts
6. **macOS thread handling**: pystray requires main thread on macOS, server runs in background thread

---

## Results

### What Works Correctly

1. **Server startup**: Loads Whisper model on startup (~10 seconds for base model)
2. **Health endpoint**: Returns model status correctly
3. **Transcription endpoint**: Successfully transcribes WebM audio files
4. **Real-world test**: Transcribed a 43MB (~29 minute) meeting recording in ~2 minutes
5. **Language detection**: Automatically detected English with high confidence
6. **Segment timestamps**: Returns start/end times for each speech segment
7. **CORS**: Configured for Chrome extension access

### Test Results
```bash
# Health check
curl http://127.0.0.1:8765/health
# Response: {"status":"ok","model_loaded":true}

# Transcription (43MB file, 29 minutes)
curl -X POST http://127.0.0.1:8765/transcribe \
  -F "file=@recording.webm"
# Response: Full transcription with segments (~2 min processing time)
```

### Problems Encountered

1. **av library build error on macOS**: Initial `pip install` failed due to ffmpeg version mismatch
   - **Solution**: Install av separately with pre-built wheel before other dependencies

2. **faster-whisper version conflicts**: v1.0.1 required older av and tokenizers versions
   - **Solution**: Upgraded to faster-whisper v1.2.1 which supports newer dependencies

3. **pystray macOS crash**: "NSWindow should only be instantiated on the main thread"
   - **Solution**: Modified main.py to run tray on main thread and server in background on macOS

4. **Python version confusion**: System had multiple Python versions (3.10 via pyenv, 3.11 via homebrew)
   - **Solution**: Used python3.11 consistently for testing

### What Remains Pending

1. **Chrome extension integration**: Extension needs to call the transcription API after recording
2. **System tray icon**: Custom icon not created yet (uses placeholder)
3. **PyInstaller build**: Not tested yet, spec file created but build not executed
4. **Auto-start on login**: Not implemented
5. **Progress feedback**: No streaming/progress during long transcriptions
6. **Storage**: Transcriptions are returned but not persisted server-side

---

## Recommendations

### Suggested Next Steps

1. **Integrate with Chrome extension**:
   - Add transcription button to recorder UI
   - Call `/transcribe` endpoint after recording stops
   - Display transcription results in extension popup or new tab

2. **Test PyInstaller build**:
   ```bash
   cd echoes-server
   ./scripts/build.sh
   ```

3. **Create custom tray icon**:
   - Add `assets/icon.png` (64x64 recommended)
   - Add `assets/icon.icns` for macOS bundle

4. **Add progress streaming** (optional):
   - Use Server-Sent Events (SSE) for long transcriptions
   - Show progress percentage in extension

### How to Integrate to Main

1. **Keep as separate project**: The server is intentionally in a separate directory (`echoes-server`) from the Chrome extension (`echoes`). This allows:
   - Independent versioning
   - Separate installation/distribution
   - Future possibility of different UIs using same server

2. **Extension changes needed**:
   ```typescript
   // In recorder or popup component
   async function transcribeRecording(blob: Blob) {
     const formData = new FormData();
     formData.append('file', blob, 'recording.webm');

     const response = await fetch('http://127.0.0.1:8765/transcribe', {
       method: 'POST',
       body: formData,
     });

     return response.json();
   }
   ```

3. **User flow**:
   - User starts Echoes Server (standalone app)
   - User opens Chrome, navigates to meeting
   - User clicks extension, starts recording
   - User stops recording
   - Extension automatically sends to server for transcription
   - Transcription displayed in UI

### Important Considerations

1. **Server must be running**: Extension should check `/health` and show friendly message if server is not available

2. **Large files**: 43MB file took ~2 minutes - consider:
   - Showing progress indicator
   - Warning user about processing time
   - Possibly chunking very long recordings

3. **Model selection**: Base model is good balance, but user could configure:
   - `tiny` for faster, less accurate
   - `small`/`medium` for better accuracy
   - `large-v3` for best quality (requires more RAM/time)

4. **First run**: Initial model download from HuggingFace (~150MB for base)
   - Consider pre-downloading or showing download progress

5. **Privacy**: All processing is local, no data leaves the machine - this is a key selling point

---

## API Reference

### Base URL
```
http://127.0.0.1:8765
```

### Endpoints

#### GET /
Health check with service info
```json
{
  "status": "ok",
  "service": "Echoes Server",
  "model_loaded": true
}
```

#### GET /health
Model status
```json
{
  "status": "ok",
  "model_loaded": true
}
```

#### POST /transcribe
Transcribe audio file

**Request:**
- Content-Type: multipart/form-data
- Body: `file` (required), `language` (optional)

**Response:**
```json
{
  "text": "Full transcription text...",
  "segments": [
    {
      "start": 0.0,
      "end": 5.2,
      "text": "Segment text..."
    }
  ],
  "language": "en",
  "language_probability": 0.98,
  "duration": 1740.5
}
```

---

## Running the Server

```bash
cd /Users/andres.mantilla/Desktop/Me/software-engineering/echoes-server
PYTHONPATH=src python -m echoes_server
```

Or after pip install:
```bash
pip install -e .
echoes-server
```
