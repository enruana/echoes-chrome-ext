# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Echoes is a Chrome extension for recording audio from meeting tabs (Google Meet, Microsoft Teams, Zoom). Built with Vite, React 18, TypeScript, and Chrome Manifest V3.

## Commands

```bash
npm run dev      # Start development server with HMR
npm run build    # TypeScript compile + Vite build (output to build/)
npm run fmt      # Format code with Prettier
npm run zip      # Build and package extension for distribution
```

## Development Workflow

1. Run `npm run build` to compile the extension
2. Load extension in Chrome: Go to `chrome://extensions/`, enable Developer mode, click "Load unpacked", select the `build/` folder
3. Navigate to a meeting page (Google Meet, Teams, or Zoom) and click the extension icon to start recording

## Architecture

### Recording Flow

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

### Key Components

- **`src/popup/`** - Recording controls UI (start/stop buttons, status display)
- **`src/background/`** - Service worker that coordinates tab capture and manages recording state
- **`src/offscreen/`** - Offscreen document that performs actual audio recording (required because service workers can't access MediaRecorder/AudioContext)
- **`src/contentScript/`** - Injected into meeting pages to detect active meetings

### Chrome APIs Used

- `chrome.tabCapture.getMediaStreamId()` - Get audio stream from a specific tab (Chrome 116+)
- `chrome.offscreen` - Create offscreen document for DOM APIs
- `chrome.runtime.getContexts()` - Check if offscreen document exists
- `chrome.runtime.sendMessage` / `onMessage` - Message passing between contexts
- `chrome.downloads` - Save recorded audio files
- `chrome.storage` - Persist extension state
- `chrome.action.setBadgeText` - Show recording indicator

### Manifest Configuration

The manifest is defined programmatically in `src/manifest.ts`. Key permissions:
- `tabCapture` - Capture audio from tabs
- `offscreen` - Create offscreen documents
- `activeTab`, `tabs` - Access tab information
- `downloads` - Save recordings
- `host_permissions` for meet.google.com, teams.microsoft.com, teams.live.com, zoom.us

### Type Declarations

Custom Chrome API type extensions are in `src/global.d.ts` for newer APIs not yet in @types/chrome (getContexts, offscreen, tabCapture.getMediaStreamId).

### Build Configuration

Vite config includes `offscreen.html` as an additional input to ensure it's bundled with the extension.
