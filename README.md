# Echoes - Chrome Extension

A Chrome extension for recording audio from online meetings and transcribing them locally using AI.

## Download

**[Download Latest Release (v0.0.1)](https://github.com/enruana/echoes-chrome-ext/releases/download/v0.0.1/echoes-0.0.1.zip)**

## Features

- Record audio from meeting tabs (Google Meet, Microsoft Teams, Zoom)
- Capture tab audio, microphone, or both simultaneously
- Real-time audio visualization during recording
- Save recordings to browser storage
- Transcribe recordings using local AI (via Echoes Server)
- Markdown formatted transcripts
- Copy transcripts to clipboard or download as files
- Import external audio files for transcription

## Requirements

- Chrome 116 or later
- [Echoes Server](https://github.com/enruana/echoes-server-app) for transcription

## Installation

### From Release (Recommended)

1. Download [`echoes-0.0.1.zip`](https://github.com/enruana/echoes-chrome-ext/releases/download/v0.0.1/echoes-0.0.1.zip)
2. Extract the ZIP file
3. Open Chrome and go to `chrome://extensions/`
4. Enable **Developer mode** (toggle in top right)
5. Click **Load unpacked**
6. Select the extracted folder

### From Source

```bash
git clone https://github.com/enruana/echoes-chrome-ext.git
cd echoes-chrome-ext
npm install
npm run build
```

Then load the `build/` folder as an unpacked extension.

## Usage

1. Start [Echoes Server](https://github.com/enruana/echoes-server-app) (required for transcription)
2. Navigate to a supported meeting platform:
   - Google Meet
   - Microsoft Teams
   - Zoom
3. Click the Echoes extension icon
4. Select capture mode (Tab Audio, Microphone, or Both)
5. Click **Start Recording**
6. A small window will appear with recording controls
7. Click **Stop Recording** when done
8. Go to **Recordings** to view, transcribe, and manage your recordings

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Package for distribution
npm run zip
```

## Architecture

```
┌─────────────┐    message     ┌──────────────┐    streamId    ┌─────────────────┐
│   Popup     │ ──────────────→│  Background  │ ─────────────→ │ Offscreen Doc   │
│ (React UI)  │                │(Service Worker)│               │ (MediaRecorder) │
└─────────────┘                └──────────────┘                └─────────────────┘
                                     │
                                     │ tabCapture.getMediaStreamId()
                                     ↓
                               ┌──────────────┐
                               │  Meeting Tab │
                               │ (audio source)│
                               └──────────────┘
```

## Tech Stack

- React 18
- TypeScript
- Vite
- Chrome Manifest V3
- IndexedDB for storage

## Related Projects

- [Echoes Server](https://github.com/enruana/echoes-server-app) - Local transcription server using Whisper AI

## License

MIT
