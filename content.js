// content.js

(function () {
  console.log("MuseScore Clean PDF Exporter initialized.");

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
      // Scroller is present but UI is missing (e.g. page load or SPA transition)
      injectExporter();
    } else if (!scroller && existingFab) {
      // Scroller is gone (user navigated away), clean up UI elements
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
    // Ensure no duplicates
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
    let checkIntervalId = null;
    let originalScrollTop = 0;

    // Reset UI and page styles back to original state
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

      if (checkIntervalId) {
        clearInterval(checkIntervalId);
        checkIntervalId = null;
      }
    }

    // Helper to compile collected images into print container and trigger window.print()
    function compileAndPrint(pageUrls, totalPages) {
      let printContainer = document.getElementById("musescore-print-container");
      if (printContainer) {
        printContainer.innerHTML = "";
      } else {
        printContainer = document.createElement("div");
        printContainer.id = "musescore-print-container";
        document.body.appendChild(printContainer);
      }

      // Append pages in order
      let pagesAppended = 0;
      for (let i = 0; i < totalPages; i++) {
        const src = pageUrls.get(i);
        if (src) {
          const img = document.createElement("img");
          img.src = src;
          printContainer.appendChild(img);
          pagesAppended++;
        } else {
          console.warn(`Page ${i + 1} was not loaded/found, skipping in PDF.`);
        }
      }

      if (pagesAppended === 0) {
        alert("Failed to extract any sheet music images. Please reload the page and try again.");
        if (printContainer && printContainer.parentNode) {
          printContainer.parentNode.removeChild(printContainer);
        }
        return;
      }

      console.log(`Triggering PDF print interface for ${pagesAppended} pages...`);
      window.print();

      // Cleanup print container after dialog closes
      window.addEventListener("afterprint", () => {
        if (printContainer && printContainer.parentNode) {
          printContainer.parentNode.removeChild(printContainer);
        }
      }, { once: true });
    }

    cancelBtn.addEventListener("click", cleanupAndRestore);

    fab.addEventListener("click", async () => {
      if (isExporting) return;
      isExporting = true;
      fab.disabled = true;
      fab.innerText = "Extracting...";

      const scroller = findScroller();
      if (!scroller) {
        alert("Could not find sheet music scroller container. Please wait for the page to fully load or refresh.");
        cleanupAndRestore();
        return;
      }

      // Show loader overlay
      overlay.classList.add("active");
      statusText.innerText = "Initializing pages...";
      percentText.innerText = "0%";
      progressFill.style.width = "0%";

      // Save current scroll position to restore later
      originalScrollTop = scroller.scrollTop;

      // Identify the page base class name dynamically using the first DIV child.
      // This allows us to filter out recommendations and ads by checking class lists.
      const firstPage = [...scroller.children].find(el => el.tagName === "DIV" && el.classList.length > 0);
      const pageClass = firstPage ? firstPage.classList[0] : "";

      const pageElements = [...scroller.children].filter(el => {
        return el.tagName === "DIV" && 
               el.id !== "musescore-temp-spacer" && 
               (!pageClass || el.classList.contains(pageClass));
      });
      const totalPages = pageElements.length;

      if (totalPages === 0) {
        alert("No page elements detected in the scroller.");
        cleanupAndRestore();
        return;
      }

      console.log(`Found ${totalPages} pages in document scroller.`);

      const pageUrls = new Map(); // pageIndex -> URL string
      let lastScrollTop = -1;
      let noScrollChangeCount = 0;

      // Function to dynamically detect the current score's image base path.
      // We ONLY check images inside the actual page wrappers to avoid recommended items or avatar icons.
      function detectCurrentScoreBasePath() {
        const currentPages = [...scroller.children].filter(el => {
          return el.tagName === "DIV" && 
                 el.id !== "musescore-temp-spacer" && 
                 (!pageClass || el.classList.contains(pageClass));
        });

        for (const page of currentPages) {
          const img = page.querySelector("img");
          if (img && img.src && img.src.startsWith("http")) {
            const match = img.src.match(/(.*\/)score_\d+/i) || img.src.match(/(.*\/)\d+\.(svg|png)/i);
            if (match) {
              return match[1]; // Returns everything up to "score_X"
            }
          }
        }
        return null;
      }

      let currentScoreBasePath = detectCurrentScoreBasePath();
      if (currentScoreBasePath) {
        console.log(`Detected score base path: ${currentScoreBasePath}`);
      }
      
      // Scroll back to the top to start sequential scan
      scroller.scrollTop = 0;

      // Monitor and scroll down step-by-step
      checkIntervalId = setInterval(() => {
        // Try to detect base path if not already found (in case first images loaded slowly)
        if (!currentScoreBasePath) {
          currentScoreBasePath = detectCurrentScoreBasePath();
          if (currentScoreBasePath) {
            console.log(`Detected score base path (deferred): ${currentScoreBasePath}`);
          }
        }

        // Get currently rendered page containers (exclude spacers, ads, recommendations)
        const currentPages = [...scroller.children].filter(el => {
          return el.tagName === "DIV" && 
                 el.id !== "musescore-temp-spacer" && 
                 (!pageClass || el.classList.contains(pageClass));
        });

        // Scan images ONLY inside these page containers
        currentPages.forEach(page => {
          const img = page.querySelector("img");
          if (img && img.src && img.src.startsWith("http")) {
            // Guard filter: ensure this image belongs to the current score
            if (currentScoreBasePath && !img.src.includes(currentScoreBasePath)) {
              return; // Skip images belonging to a different score (remnants of SPAs)
            }

            // Extrapolate page index from image URL file name (e.g. score_0.svg or 0.png)
            const match = img.src.match(/score_(\d+)\.(svg|png|jpg|jpeg)/i) || 
                          img.src.match(/score-(\d+)/i) || 
                          img.src.match(/\/(\d+)\.(svg|png|jpg|jpeg)/i);
            if (match) {
              const pageIndex = parseInt(match[1], 10);
              if (pageIndex >= 0 && pageIndex < totalPages) {
                pageUrls.set(pageIndex, img.src);
              }
            }
          }
        });

        // Update progress UI
        const loadedCount = pageUrls.size;
        const percentage = Math.round((loadedCount / totalPages) * 100);
        percentText.innerText = `${percentage}%`;
        progressFill.style.width = `${percentage}%`;
        statusText.innerText = `Loading sheet pages: ${loadedCount} of ${totalPages}...`;

        // If we successfully found all pages, compile and print!
        if (loadedCount === totalPages) {
          clearInterval(checkIntervalId);
          checkIntervalId = null;
          statusText.innerText = "Compiling PDF document...";

          setTimeout(() => {
            scroller.scrollTop = originalScrollTop; // Restore user's original scroll view
            compileAndPrint(pageUrls, totalPages);
            cleanupAndRestore();
          }, 800);
          return;
        }

        // Scroll down by ~75% of container height to bring new pages into view naturally
        scroller.scrollTop += Math.round(scroller.clientHeight * 0.75);

        // Check if we hit the bottom of the container
        if (scroller.scrollTop === lastScrollTop) {
          noScrollChangeCount++;
          // Wait up to 5 ticks (1.5s) at the bottom in case pages are loading slowly
          if (noScrollChangeCount >= 5) {
            clearInterval(checkIntervalId);
            checkIntervalId = null;

            statusText.innerText = "Compiling PDF document (partial)...";
            setTimeout(() => {
              scroller.scrollTop = originalScrollTop; // Restore scroll view
              compileAndPrint(pageUrls, totalPages);
              cleanupAndRestore();
            }, 800);
          }
        } else {
          lastScrollTop = scroller.scrollTop;
          noScrollChangeCount = 0;
        }
      }, 300); // 300ms intervals provide a smooth scroll pace
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
        sendResponse({ status: "error", message: "Sheet music scroller component not found. Make sure you are on a score preview page." });
      }
    }
    return true; // Keep channel open for asynchronous responses
  });
})();
