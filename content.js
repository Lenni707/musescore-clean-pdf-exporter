// content.js

(function () {
  console.log("MuseScore Clean PDF Exporter initialized.");

  // Check if we already injected the button to avoid duplicates
  if (document.querySelector(".musescore-pdf-fab")) return;

  // Search for the MuseScore scroller component
  function findScroller() {
    return document.querySelector("#jmuse-scroller-component") || 
           document.querySelector('div[class*="jmuse-scroller"]') ||
           document.querySelector('div[id*="scroller-component"]');
  }

  // Poll for the scroller to become available (dynamic loading)
  const scrollerCheckInterval = setInterval(() => {
    const scroller = findScroller();
    if (scroller) {
      clearInterval(scrollerCheckInterval);
      injectExporter();
    }
  }, 1000);

  function injectExporter() {
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
    let originalStyles = [];
    let originalScrollerHeight = "";
    let spacerDiv = null;

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

      // Restore scroller elements positions
      const scroller = findScroller();
      if (scroller) {
        originalStyles.forEach(item => {
          if (item.el) {
            item.el.style.position = item.position;
          }
        });
        scroller.style.height = originalScrollerHeight;
      }
      originalStyles = [];

      // Remove spacer
      if (spacerDiv && spacerDiv.parentNode) {
        spacerDiv.parentNode.removeChild(spacerDiv);
      }
      spacerDiv = null;
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

      // Identify all page containers (exclude any scripts/styles or our spacer if already present)
      const allChildren = [...scroller.children];
      const pages = allChildren.filter(el => el.tagName === "DIV" && el.id !== "musescore-temp-spacer");

      if (pages.length === 0) {
        alert("No page elements found in the scroller.");
        cleanupAndRestore();
        return;
      }

      console.log(`Found ${pages.length} sheet music pages wrapper.`);

      // 1. Save original styles and stack all pages absolutely at the top
      originalStyles = [];
      originalScrollerHeight = scroller.style.height || "";

      pages.forEach(page => {
        originalStyles.push({
          el: page,
          position: page.style.position || ""
        });
        page.style.position = "absolute";
      });

      // 2. Add temporary scroll spacer and size down viewport to trigger lazy load for stacked divs
      spacerDiv = document.createElement("div");
      spacerDiv.id = "musescore-temp-spacer";
      spacerDiv.style.height = "2000px";
      scroller.appendChild(spacerDiv);

      scroller.style.height = "9px";
      scroller.scrollTo(0, 0);
      scroller.scrollTo(0, 1); // Triggers lazy-load scrolling listeners

      statusText.innerText = `Connecting lazy-loader (0/${pages.length} pages)...`;

      // 3. Start monitoring progress
      let lastLoadedCount = -1;
      checkIntervalId = setInterval(() => {
        let loadedCount = 0;
        const pageAssets = [];

        pages.forEach((page, index) => {
          const img = page.querySelector("img");
          const svg = page.querySelector("svg");

          if (img && img.src && img.src.startsWith("http") && img.complete) {
            loadedCount++;
            pageAssets.push({ type: "img", el: img });
          } else if (svg) {
            loadedCount++;
            pageAssets.push({ type: "svg", el: svg });
          }
        });

        // Update progress
        const percentage = Math.round((loadedCount / pages.length) * 100);
        percentText.innerText = `${percentage}%`;
        progressFill.style.width = `${percentage}%`;

        if (loadedCount !== lastLoadedCount) {
          statusText.innerText = `Loading sheet pages: ${loadedCount} of ${pages.length}...`;
          lastLoadedCount = loadedCount;
        }

        // 4. Once all pages are loaded, compile and print!
        if (loadedCount === pages.length) {
          clearInterval(checkIntervalId);
          checkIntervalId = null;
          statusText.innerText = "Compiling PDF document...";

          setTimeout(() => {
            // Restore scroller state first
            cleanupAndRestore();

            // Create temporary printing container
            let printContainer = document.getElementById("musescore-print-container");
            if (printContainer) {
              printContainer.innerHTML = "";
            } else {
              printContainer = document.createElement("div");
              printContainer.id = "musescore-print-container";
              document.body.appendChild(printContainer);
            }

            // Append clones of all page assets
            pageAssets.forEach(asset => {
              if (asset.type === "img") {
                const clone = document.createElement("img");
                clone.src = asset.el.src;
                printContainer.appendChild(clone);
              } else if (asset.type === "svg") {
                const clone = asset.el.cloneNode(true);
                printContainer.appendChild(clone);
              }
            });

            // Trigger browser print
            console.log("Triggering PDF print interface...");
            window.print();

            // Cleanup print container after dialog closes
            window.addEventListener("afterprint", () => {
              if (printContainer && printContainer.parentNode) {
                printContainer.parentNode.removeChild(printContainer);
              }
            }, { once: true });

          }, 800);
        }
      }, 500);
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
