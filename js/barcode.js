/**
 * BOOKISH LIBRARY - BARCODE SCANNER
 * Client-side barcode detection using QuaggaJS with multi-barcode support
 */

let detectedBarcodes = new Set();
let detectionTimer = null;

/**
 * Start barcode scanner with multi-barcode detection
 */
export function startBarcodeScanner(containerId, onDetected, onError) {
  // Reset detection state
  detectedBarcodes.clear();
  if (detectionTimer) {
    clearTimeout(detectionTimer);
  }

  Quagga.init({
inputStream: {
      name: "Live",
      type: "LiveStream",
      target: document.querySelector(`#${containerId}`),
      constraints: {
        facingMode: "environment",
        width: { min: 640, ideal: 1280, max: 1920 },
        height: { min: 480, ideal: 720, max: 1080 },
        aspectRatio: { ideal: 1.777777778 }
      }
    },    decoder: {
      readers: [
        "ean_reader",
        "ean_8_reader",
        "code_128_reader",
        "code_39_reader",
        "upc_reader",
        "upc_e_reader"
      ]
},
    locate: true,
    numOfWorkers: 2,
    frequency: 10,  }, function(err) {
    if (err) {
      console.error('Quagga init error:', err);
      onError('Failed to start camera. Please check permissions.');
      return;
    }
    
    console.log("Quagga initialized - scanning for multiple barcodes...");
    Quagga.start();
    
    // Update status
    const statusEl = document.getElementById('barcodeStatus');
    if (statusEl) {
      statusEl.textContent = 'Scanning... Hold steady for 5 seconds to detect all barcodes';
    }
  });

  // Listen for barcode detections
  Quagga.onDetected(function(result) {
    const code = result.codeResult.code;
    console.log("Barcode detected:", code);
    
    // Remove any hyphens/spaces
    const cleanCode = code.replace(/[-\s]/g, '');
    
    // Only accept valid ISBN lengths (10 or 13 digits)
    if (cleanCode.length === 10 || cleanCode.length === 13) {
      console.log("Valid ISBN detected:", cleanCode);
      detectedBarcodes.add(cleanCode);
      
      // Update status
      const statusEl = document.getElementById('barcodeStatus');
      if (statusEl) {
        statusEl.textContent = `Found ${detectedBarcodes.size} barcode(s)... Keep scanning...`;
      }
      
      // Reset timer - collect barcodes for 5 seconds after last detection
      if (detectionTimer) {
        clearTimeout(detectionTimer);
      }
      
      detectionTimer = setTimeout(() => {
        console.log(`Finished scanning. Found ${detectedBarcodes.size} unique ISBNs:`, Array.from(detectedBarcodes));
        onDetected(Array.from(detectedBarcodes));
      }, 5000); // Wait 5 seconds after last barcode
      
    } else {
      console.log("Invalid ISBN length, ignoring:", cleanCode);
    }
  });
}

/**
 * Stop barcode scanner
 */
export function stopBarcodeScanner() {
  if (detectionTimer) {
    clearTimeout(detectionTimer);
    detectionTimer = null;
  }
  detectedBarcodes.clear();
  Quagga.stop();
}
