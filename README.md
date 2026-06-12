# MuseScore Clean PDF Exporter

A premium Chrome extension that extracts dynamic preview sheet music on `musescore.com` and compiles them into a clean, high-quality, print-ready PDF document without watermarks, ads, sidebar controls, or headers/footers.

## Features

- **Automated Lazy Loading:** Automatically tricks MuseScore's lazy-loader into loading all page images concurrently.
- **Vector Quality Preservation:** Clones original SVGs (when available) or high-res PNGs to render pages at original clarity in the print output.
- **Glassmorphic Progress UI:** Sleek glassmorphic loader modal showing extraction progress in real-time.
- **Non-Destructive Printing:** Temporary print container injected only during printing, preserving original page layout and state once printed.
- **Interactive Extension Popup:** Trigger the export directly from the extension's toolbar icon or using the floating action button on the page.

## Installation

Since this extension is unofficial and bypasses the paywall limits for viewing sheets, it is not distributed on the Chrome Web Store. To install it, follow these steps:

1. **Download / Clone the Repository:**
   Ensure this project repository is downloaded to a local folder on your computer.
2. **Open Extensions Page:**
   Open Google Chrome and navigate to `chrome://extensions/`.
3. **Enable Developer Mode:**
   Toggle the **"Developer mode"** switch in the top-right corner of the Extensions page.
4. **Load Unpacked Extension:**
   Click the **"Load unpacked"** button in the top-left corner.
5. **Select Project Folder:**
   Choose the `musescore-clean-pdf-exporter` directory that contains the `manifest.json` file.
6. The extension is now active and ready to use!

## How to Use

1. Navigate to any sheet music details page on [musescore.com](https://musescore.com) (e.g., `https://musescore.com/user/12345/scores/67890`).
2. You will see a glowing gradient floating action button in the bottom right corner labeled **"Clean PDF Export"**.
3. Click this button (or click the extension icon in your Chrome toolbar and choose **"Export Clean PDF"**).
4. Wait for the progress overlay to load all sheet pages (takes a few seconds depending on page count and network speed).
5. Once completed, the native browser Print dialog will open.
6. Set the following options in the Print dialog for optimal clean layout:
   - **Destination:** Save as PDF
   - **Paper Size:** A4 (or Letter)
   - **Margins:** None (or Default)
   - **Headers and footers:** **Uncheck** (crucial for a clean sheet document without browser page info)
7. Save the PDF!

## Legal Disclaimer

This project is created for personal, educational, and backup study purposes only. It is intended to help users print public domain or user-created sheet music that is otherwise restricted. Please respect copyright laws and support music creators. Do not distribute or sell copyrighted sheet music downloaded with this tool.
