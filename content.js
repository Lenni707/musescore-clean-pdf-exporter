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

    // Direct DOM cloning export and printing
    function startDOMExportPass(cachedPages) {
      if (shouldAbort) return;

      statusText.innerText = "Assembling PDF document...";
      percentText.innerText = "100%";
      progressFill.style.width = "100%";

      setTimeout(() => {
        try {
          const scroller = findScroller();
          if (!scroller) {
            alert("Scroller not found. Please refresh page.");
            cleanupAndRestore();
            return;
          }

          let printContainer = document.getElementById("musescore-print-container");
          if (printContainer) {
            printContainer.innerHTML = "";
          } else {
            printContainer = document.createElement("div");
            printContainer.id = "musescore-print-container";
            document.body.appendChild(printContainer);
          }

          // Sort the cached pages by their vertical position (top to bottom)
          const sortedElements = [...cachedPages.values()]
            .sort((a, b) => a.yPos - b.yPos)
            .map(p => p.element);

          let pagesAppended = 0;
          for (let i = 0; i < sortedElements.length; i++) {
            const el = sortedElements[i];
            printContainer.appendChild(el);
            pagesAppended++;
          }

          cleanupAndRestore();
          scroller.scrollTop = originalScrollTop; // Restore view

          if (pagesAppended === 0) {
            alert("Failed to extract sheet pages. Please ensure the score is loaded and try again.");
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

        } catch (err) {
          console.error("DOM export error:", err);
          alert(`Export failed: ${err.message}`);
          cleanupAndRestore();
        }
      }, 500);
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
      // Pass 1: Natural Scroll to load all images into memory/DOM and cache them
      // -------------------------------------------------------------
      const cachedPages = new Map();
      let lastScrollTop = -1;
      let noScrollChangeCount = 0;
      scroller.scrollTop = 0;

      checkIntervalId = setInterval(async () => {
        if (shouldAbort) return;

        // Find page containers currently in DOM
        const currentPages = [...scroller.children].filter(el => {
          return el.tagName === "DIV" && 
                 el.id !== "musescore-temp-spacer" && 
                 (!pageClass || el.classList.contains(pageClass));
        });

        currentPages.forEach(page => {
          const svg = page.querySelector("svg");
          const img = page.querySelector("img");

          const yPos = page.offsetTop || (page.getBoundingClientRect().top + scroller.scrollTop);

          // Check if already cached (with 50px tolerance)
          const alreadyCached = [...cachedPages.values()].some(p => Math.abs(p.yPos - yPos) < 50);
          if (alreadyCached) return;

          if (svg) {
            const clonedSvg = svg.cloneNode(true);
            clonedSvg.removeAttribute("class");
            clonedSvg.style.width = "100%";
            clonedSvg.style.height = "auto";
            clonedSvg.style.display = "block";
            cachedPages.set(yPos, { yPos: yPos, element: clonedSvg });
          } else if (img && img.src && img.complete) {
            const src = img.src;
            // Filter out tracking/empty/placeholder images
            if (src.startsWith("http") && (src.includes("score_") || src.includes("score-") || src.includes("scoredata"))) {
              const clonedImg = document.createElement("img");
              clonedImg.src = src;
              clonedImg.style.width = "100%";
              clonedImg.style.height = "auto";
              clonedImg.style.display = "block";
              cachedPages.set(yPos, { yPos: yPos, element: clonedImg });
            }
          }
        });

        const loadedCount = cachedPages.size;
        const percentage = Math.round((loadedCount / totalPages) * 100);
        percentText.innerText = `${percentage}%`;
        progressFill.style.width = `${percentage}%`;
        statusText.innerText = `Caching sheet pages: ${loadedCount} of ${totalPages}...`;

        if (loadedCount === totalPages) {
          clearInterval(checkIntervalId);
          checkIntervalId = null;
          startDOMExportPass(cachedPages);
          return;
        }

        // Scroll down in natural layout to trigger lazy load observers
        scroller.scrollTop += Math.round(scroller.clientHeight * 0.75);

        if (scroller.scrollTop === lastScrollTop) {
          noScrollChangeCount++;
          if (noScrollChangeCount >= 6) {
            clearInterval(checkIntervalId);
            checkIntervalId = null;
            // Scroll limit reached; start export pass on whatever pages loaded
            startDOMExportPass(cachedPages);
          }
        } else {
          lastScrollTop = scroller.scrollTop;
          noScrollChangeCount = 0;
        }
      }, 300);
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
