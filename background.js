// background.js

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "captureTab") {
    // Capture the visible viewport of the active tab
    chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error("Capture failed:", chrome.runtime.lastError.message);
        sendResponse({ status: "error", message: chrome.runtime.lastError.message });
      } else {
        sendResponse({ status: "success", dataUrl: dataUrl });
      }
    });
    return true; // Keep the message channel open for asynchronous response
  }
});
