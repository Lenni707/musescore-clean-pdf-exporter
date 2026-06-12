// popup.js

document.addEventListener("DOMContentLoaded", () => {
  const actionBtn = document.getElementById("action-btn");
  const btnText = document.getElementById("btn-text");
  const btnIcon = document.getElementById("btn-icon");

  // SVG Icons
  const downloadIconSvg = `<path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z"/>`;
  const externalLinkSvg = `<path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>`;

  let currentTab = null;
  let isMuseScorePage = false;

  // Query active tab to check if it's MuseScore
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0]) {
      currentTab = tabs[0];
      const url = currentTab.url || "";
      
      if (url.includes("musescore.com")) {
        isMuseScorePage = true;
        btnText.innerText = "Export Clean PDF";
        btnIcon.innerHTML = downloadIconSvg;
      } else {
        btnText.innerText = "Browse MuseScore";
        btnIcon.innerHTML = externalLinkSvg;
      }
    }
  });

  actionBtn.addEventListener("click", () => {
    if (isMuseScorePage && currentTab) {
      // Send message to content script to trigger export
      chrome.tabs.sendMessage(currentTab.id, { action: "triggerExport" }, (response) => {
        if (chrome.runtime.lastError) {
          // Content script might not have loaded or permission issue
          alert("Unable to communicate with MuseScore tab. Please refresh the MuseScore page and try again.");
        } else if (response && response.status === "error") {
          alert(response.message);
        } else {
          // Success, close the popup and let the page handle the overlay
          window.close();
        }
      });
    } else {
      // Open musescore.com in a new tab
      chrome.tabs.create({ url: "https://musescore.com" });
    }
  });
});
