# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Echoes is a Chrome extension built with Vite, React 18, TypeScript, and Chrome Manifest V3. It was scaffolded with [create-chrome-ext](https://github.com/guocaoyi/create-chrome-ext).

## Commands

```bash
npm run dev      # Start development server with HMR
npm run build    # TypeScript compile + Vite build (output to build/)
npm run fmt      # Format code with Prettier
npm run zip      # Build and package extension for distribution
```

## Development Workflow

1. Run `npm run dev` to start the Vite dev server
2. Load extension in Chrome: Go to `chrome://extensions/`, enable Developer mode, click "Load unpacked", select the `build/` folder
3. For standalone page debugging:
   - Popup: `http://localhost:3000/popup.html`
   - Options: `http://localhost:3000/options.html`
   - DevTools: `http://localhost:3000/devtools.html`

## Architecture

### Extension Entry Points

The extension has multiple entry points, each with its own React app:

- **`src/popup/`** - Browser action popup (click extension icon)
- **`src/sidepanel/`** - Chrome side panel UI
- **`src/options/`** - Extension options page
- **`src/newtab/`** - New tab override page
- **`src/devtools/`** - DevTools panel
- **`src/background/`** - Service worker (background script)
- **`src/contentScript/`** - Injected into web pages

### Manifest Configuration

The manifest is defined programmatically in `src/manifest.ts` using `@crxjs/vite-plugin`. It reads metadata from `package.json` and adds a dev indicator to the name in development mode.

### Chrome APIs Used

- `chrome.storage.sync` - Persist data across browser sessions
- `chrome.runtime.sendMessage` / `onMessage` - Message passing between extension contexts
- `chrome.sidePanel` - Side panel API

### Build Configuration

Vite config (`vite.config.ts`) uses `@crxjs/vite-plugin` to handle Chrome extension bundling. Output goes to `build/` directory.
