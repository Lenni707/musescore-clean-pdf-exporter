// content.js

(function () {
  console.log("MuseScore Clean PDF Exporter (Screenshot Mode) initialized.");

  // Check if we already injected the button to avoid duplicates
  if (document.querySelector(".musescore-pdf-fab")) return;

  // Search for the MuseScore scroller component
  function findScroller() {
    // 1. Direct standard selectors
    const standard = document.querySelector("#jmuse-scroller-component") || 
                     document.querySelector('div[class*="jmuse-scroller"]') ||
                     document.querySelector('div[id*="scroller-component"]');
    if (standard) return standard;

    // 2. Dynamic trace: Find any img that looks like a sheet page and walk up the DOM
    const images = document.querySelectorAll("img");
    for (const img of images) {
      const src = img.src || "";
      if (src.startsWith("http") && (src.includes("score_") || src.includes("score-") || src.includes("scoredata"))) {
        let el = img.parentElement;
        while (el && el !== document.body) {
          if (el.id === "jmuse-scroller-component" || 
              el.id.includes("scroller") || 
              el.className.includes("scroller") || 
              el.className.includes("score-viewer")) {
            return el;
          }
          el = el.parentElement;
        }
        
        // Fallback parent: Find the immediate parent container of the page elements
        let parent = img.parentElement;
        while (parent && parent !== document.body) {
          if (parent.children.length > 1) {
            const siblings = [...parent.children];
            const hasManyPages = siblings.filter(child => child.tagName === "DIV" && child.querySelector("img")).length >= 1;
            if (hasManyPages) {
              return parent;
            }
          }
          parent = parent.parentElement;
        }
      }
    }
    return null;
  }

  // Persistent poll to handle SPA navigation and re-renders
  setInterval(() => {
    const scroller = findScroller();
    const existingFab = document.querySelector(".musescore-pdf-fab");

    if (scroller && !existingFab) {
      injectExporter();
    } else if (!scroller && existingFab) {
      removeExporter();
    }
  }, 1000);

  function removeExporter() {
    const fab = document.querySelector(".musescore-pdf-fab");
    if (fab) fab.remove();

    const overlay = document.querySelector(".musescore-pdf-overlay");
    if (overlay) overlay.remove();

    const printContainer = document.getElementById("musescore-print-container");
    if (printContainer) printContainer.remove();
  }

  function injectExporter() {
    removeExporter();

    // 1. Create Floating Action Button (FAB)
    const fab = document.createElement("button");
    fab.className = "musescore-pdf-fab";
    fab.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z"/>
      </svg>
      Clean PDF Export
    `;
    document.body.appendChild(fab);

    // 2. Create Modal Progress Overlay
    const overlay = document.createElement("div");
    overlay.className = "musescore-pdf-overlay";
    overlay.innerHTML = `
      <div class="musescore-pdf-modal">
        <h3>MuseScore PDF Exporter</h3>
        <p id="musescore-pdf-status">Preparing page extraction...</p>
        
        <div class="musescore-pdf-loader-wrapper">
          <div class="musescore-pdf-spinner"></div>
          <div class="musescore-pdf-progress-text" id="musescore-pdf-percentage">0%</div>
        </div>

        <div class="musescore-pdf-bar-container">
          <div class="musescore-pdf-bar-fill" id="musescore-pdf-progress-fill"></div>
        </div>

        <button class="musescore-pdf-btn-cancel" id="musescore-pdf-cancel">Cancel</button>
      </div>
    `;
    document.body.appendChild(overlay);

    const statusText = overlay.querySelector("#musescore-pdf-status");
    const percentText = overlay.querySelector("#musescore-pdf-percentage");
    const progressFill = overlay.querySelector("#musescore-pdf-progress-fill");
    const cancelBtn = overlay.querySelector("#musescore-pdf-cancel");

    let isExporting = false;
    let shouldAbort = false;
    let checkIntervalId = null;
    let originalScrollTop = 0;

    function cleanupAndRestore() {
      isExporting = false;
      fab.disabled = false;
      fab.innerHTML = `
        <svg viewBox="0 0 24 24">
          <path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z"/>
        </svg>
        Clean PDF Export
      `;
      overlay.classList.remove("active");
      overlay.style.display = "flex"; // Restore display style

      // Remove temporary fullscreen stylesheet
      const tempStyle = document.getElementById("musescore-temp-print-styles");
      if (tempStyle) tempStyle.remove();
    }

    cancelBtn.addEventListener("click", () => {
      shouldAbort = true;
      cleanupAndRestore();
    });

    // Capture tab via background script and crop the page element
    function captureAndCropPage(pageElement) {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: "captureTab" }, (response) => {
          if (!response || response.status === "error") {
            reject(new Error(response ? response.message : "Capture failed"));
            return;
          }

          const img = new Image();
          img.onload = () => {
            try {
              const rect = pageElement.getBoundingClientRect();
              const scale = window.devicePixelRatio || 1;

              const canvas = document.createElement("canvas");
              canvas.width = rect.width * scale;
              canvas.height = rect.height * scale;
              const ctx = canvas.getContext("2d");

              // Draw screenshot cropped to page elements bounding box
              ctx.drawImage(
                img,
                rect.left * scale,
                rect.top * scale,
                rect.width * scale,
                rect.height * scale,
                0,
                0,
                rect.width * scale,
                rect.height * scale
              );

              resolve(canvas.toDataURL("image/png"));
            } catch (err) {
              reject(err);
            }
          };
          img.onerror = () => reject(new Error("Failed to load screenshot"));
          img.src = response.dataUrl;
        });
      });
    }

    // Wait for the page image to load/render inside the DOM page wrapper
    function waitForPageImage(pageElement) {
      return new Promise((resolve) => {
        let attempts = 0;
        const interval = setInterval(() => {
          const img = pageElement.querySelector("img");
          const svg = pageElement.querySelector("svg");
          attempts++;
          if ((img && img.src && img.complete) || svg || attempts > 20) {
            clearInterval(interval);
            setTimeout(resolve, 100); // Settlement timeout
          }
        }, 100);
      });
    }

    // Compile cropped screenshot dataURLs into print container and trigger print
    function compileAndPrint(pageUrls, totalPages) {
      let printContainer = document.getElementById("musescore-print-container");
      if (printContainer) {
        printContainer.innerHTML = "";
      } else {
        printContainer = document.createElement("div");
        printContainer.id = "musescore-print-container";
        document.body.appendChild(printContainer);
      }

      let pagesAppended = 0;
      for (let i = 0; i < totalPages; i++) {
        const src = pageUrls.get(i);
        if (src) {
          const img = document.createElement("img");
          img.src = src;
          printContainer.appendChild(img);
          pagesAppended++;
        }
      }

      if (pagesAppended === 0) {
        alert("Failed to capture any pages. Please check permissions and try again.");
        if (printContainer.parentNode) printContainer.parentNode.removeChild(printContainer);
        return;
      }

      console.log(`Printing PDF with ${pagesAppended} pages...`);
      window.print();

      window.addEventListener("afterprint", () => {
        if (printContainer && printContainer.parentNode) {
          printContainer.parentNode.removeChild(printContainer);
        }
      }, { once: true });
    }

    fab.addEventListener("click", async () => {
      if (isExporting) return;
      isExporting = true;
      shouldAbort = false;
      fab.disabled = true;
      fab.innerText = "Preparing...";

      const scroller = findScroller();
      if (!scroller) {
        alert("Scroller not found. Please refresh page.");
        cleanupAndRestore();
        return;
      }

      overlay.classList.add("active");
      statusText.innerText = "Initializing pages...";
      percentText.innerText = "0%";
      progressFill.style.width = "0%";

      originalScrollTop = scroller.scrollTop;

      // Identify page elements dynamically
      const firstPage = [...scroller.children].find(el => el.tagName === "DIV" && el.classList.length > 0);
      const pageClass = firstPage ? firstPage.classList[0] : "";

      const pageElements = [...scroller.children].filter(el => {
        return el.tagName === "DIV" && 
               el.id !== "musescore-temp-spacer" && 
               (!pageClass || el.classList.contains(pageClass));
      });
      const totalPages = pageElements.length;

      if (totalPages === 0) {
        alert("No sheet page elements detected.");
        cleanupAndRestore();
        return;
      }

      // -------------------------------------------------------------
      // Pass 1: Natural Scroll to load all images into memory/DOM
      // -------------------------------------------------------------
      let lastScrollTop = -1;
      let noScrollChangeCount = 0;
      scroller.scrollTop = 0;

      checkIntervalId = setInterval(async () => {
        if (shouldAbort) return;

        // Count loaded pages currently in DOM
        const currentPages = [...scroller.children].filter(el => {
          return el.tagName === "DIV" && 
                 el.id !== "musescore-temp-spacer" && 
                 (!pageClass || el.classList.contains(pageClass));
        });

        let loadedCount = 0;
        currentPages.forEach(page => {
          const img = page.querySelector("img");
          const svg = page.querySelector("svg");
          if ((img && img.src && img.complete) || svg) {
            loadedCount++;
          }
        });

        const percentage = Math.round((loadedCount / totalPages) * 100);
        percentText.innerText = `${percentage}%`;
        progressFill.style.width = `${percentage}%`;
        statusText.innerText = `Caching sheet pages: ${loadedCount} of ${totalPages}...`;

        if (loadedCount === totalPages) {
          clearInterval(checkIntervalId);
          checkIntervalId = null;
          startCapturePass();
          return;
        }

        // Scroll down in natural layout to trigger lazy load observers
        scroller.scrollTop += Math.round(scroller.clientHeight * 0.75);

        if (scroller.scrollTop === lastScrollTop) {
          noScrollChangeCount++;
          if (noScrollChangeCount >= 6) {
            clearInterval(checkIntervalId);
            checkIntervalId = null;
            // Scroll limit reached; start capture pass on whatever pages loaded
            startCapturePass();
          }
        } else {
          lastScrollTop = scroller.scrollTop;
          noScrollChangeCount = 0;
        }
      }, 300);

      // -------------------------------------------------------------
      // Pass 2: Print Layout Injection and Visual Capture Sweep
      // -------------------------------------------------------------
      async function startCapturePass() {
        if (shouldAbort) return;
        
        statusText.innerText = "Applying clean print layout...";
        percentText.innerText = "0%";
        progressFill.style.width = "0%";

        // Inject fullscreen styles to isolate sheet music pages
        const tempStyle = document.createElement("style");
        tempStyle.id = "musescore-temp-print-styles";
        tempStyle.textContent = `
          ::-webkit-scrollbar {
            display: none !important;
          }
          #jmuse-scroller-component,
          div[class*="jmuse-scroller"],
          div[id*="scroller-component"] {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            z-index: 9999999 !important;
            background: #ffffff !important;
            overflow: auto !important;
          }
          body > :not(#jmuse-scroller-component):not(div[class*="jmuse-scroller"]):not(div[id*="scroller-component"]):not(.musescore-pdf-overlay) {
            display: none !important;
          }
          *, [class*="blur"], [class*="locked"], [class*="paywall"] {
            filter: none !important;
            backdrop-filter: none !important;
          }
          [class*="paywall"],
          [class*="upgrade"],
          [class*="promo"],
          [class*="banner"],
          [class*="obfuscation"],
          div[class*="shield"],
          .react-shield-overlay {
            display: none !important;
            opacity: 0 !important;
            pointer-events: none !important;
          }
        `;
        document.head.appendChild(tempStyle);

        const pageUrls = new Map();
        scroller.scrollTop = 0;

        try {
          // Identify elements under the new fullscreen scroller
          const capturePages = [...scroller.children].filter(el => {
            return el.tagName === "DIV" && 
                   el.id !== "musescore-temp-spacer" && 
                   (!pageClass || el.classList.contains(pageClass));
          });

          for (let i = 0; i < totalPages; i++) {
            if (shouldAbort) return;

            const pageElement = capturePages[i];
            if (!pageElement) continue;

            statusText.innerText = `Capturing page ${i + 1} of ${totalPages}...`;
            pageElement.scrollIntoView({ block: "center", inline: "center" });

            // Settle layout positioning
            await waitForPageImage(pageElement);

            if (shouldAbort) return;

            // Temporarily hide progress overlay during screenshot
            overlay.style.display = "none";
            await new Promise(r => setTimeout(r, 80));

            // Capture and Crop
            const croppedSrc = await captureAndCropPage(pageElement);
            pageUrls.set(i, croppedSrc);

            // Restore progress overlay
            overlay.style.display = "flex";

            const percentage = Math.round(((i + 1) / totalPages) * 100);
            percentText.innerText = `${percentage}%`;
            progressFill.style.width = `${percentage}%`;
          }

          if (shouldAbort) return;

          statusText.innerText = "Assembling PDF document...";
          setTimeout(() => {
            cleanupAndRestore();
            scroller.scrollTop = originalScrollTop; // Restore view
            compileAndPrint(pageUrls, totalPages);
          }, 500);

        } catch (err) {
          console.error("Capture loop error:", err);
          alert(`Export failed during screen capture: ${err.message}`);
          cleanupAndRestore();
        }
      }
    });
  }

  // Listen for messages from the extension popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "triggerExport") {
      const fab = document.querySelector(".musescore-pdf-fab");
      if (fab) {
        if (!fab.disabled) {
          fab.click();
          sendResponse({ status: "started" });
        } else {
          sendResponse({ status: "running" });
        }
      } else {
        sendResponse({ status: "error", message: "Exporter not active on this page." });
      }
    }
    return true;
  });
})();
