/// <reference types="vite/client" />

declare const __APP_VERSION__: string

// Chrome tabCapture API extension
declare namespace chrome.tabCapture {
  function getMediaStreamId(options: {
    targetTabId?: number
    consumerTabId?: number
  }): Promise<string>
}
