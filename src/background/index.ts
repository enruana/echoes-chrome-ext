// Background service worker
// Minimal - recording is handled in the popup

chrome.runtime.onInstalled.addListener(() => {
  console.log('Echoes extension installed')
})

export {}
