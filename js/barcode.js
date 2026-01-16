/**
 * BOOKISH LIBRARY - BARCODE SCANNER
 * Client-side barcode detection with visual feedback and tap-to-focus
 */

let detectedBarcodes = new Set();
let detectionTimer = null;
let videoElement = null;

/**
 * Start barcode scanner with multi-barcode detection
 */
export function startBarcodeScanner(containerId, onDetected, onError) {
  // Reset detection state
  detectedBarcodes.clear();
  if (detectionTimer) {
    clearTimeout(detectionTimer);
  }

  const container = document.querySelector(`#${containerId}`);
  
  Quagga.init({
    inputStream: {
      name: "Live",
      type: "LiveStream",
      target: container,
      constraints: {
        facingMode: "environment",
        width: { min: 640, ideal: 1280, max: 1920 },
        height: { min: 480, ideal: 720, max: 1080 },
        aspectRatio: { ideal: 1.777777778 }
      }
    },
    locate: true,
    numOfWorkers: 2,
    frequency: 10,
    decoder: {
      readers: [
        "ean_reader",
        "ean_8_reader",
        "code_128_reader",
        "code_39_reader",
        "upc_reader",
        "upc_e_reader"
      ],
      debug: {
        drawBoundingBox: true,
        showFrequency: false,
        drawScanline: true,
        showPattern: false
      }
    }
  }, function(err) {
    if (err) {
      console.error('Quagga init error:', err);
      onError('Failed to start camera. Please check permissions.');
      return;
    }
    
    console.log("Quagga initialized - scanning for multiple barcodes...");
    Quagga.start();
    
    // Get video element for tap-to-focus
    videoElement = container.querySelector('video');
    
    // Add tap-to-focus
    if (videoElement) {
      setupTapToFocus(videoElement);
    }
    
    // Update status
    updateStatus('📷 Scanning... Tap screen to focus');
  });

  // Listen for barcode detections
  Quagga.onDetected(function(result) {
    const code = result.codeResult.code;
    console.log("Barcode detected:", code);
    
    // Remove any hyphens/spaces
    const cleanCode = code.replace(/[-\s]/g, '');
    
    // Only accept valid ISBN lengths (10 or 13 digits)
    if (cleanCode.length === 10 || cleanCode.length === 13) {
      console.log("✅ Valid ISBN detected:", cleanCode);
      detectedBarcodes.add(cleanCode);
      
      // Visual feedback - flash green
      flashBarcodeDetection(true);
      
      // Update status - clear "SCANNED!" message
      updateStatus(`✅ SCANNED! Found ${detectedBarcodes.size} ISBN(s)`, 'success');
      
      // Reset timer - collect barcodes for 5 seconds after last detection
      if (detectionTimer) {
        clearTimeout(detectionTimer);
      }
      
      detectionTimer = setTimeout(() => {
        console.log(`Finished scanning. Found ${detectedBarcodes.size} unique ISBNs:`, Array.from(detectedBarcodes));
        updateStatus('🔍 Processing barcodes...', 'info');
        onDetected(Array.from(detectedBarcodes));
      }, 5000);
      
    } else {
      console.log("Invalid ISBN length, ignoring:", cleanCode);
      // Flash yellow for invalid barcode
      flashBarcodeDetection(false);
    }
  });
}

/**
 * Setup tap-to-focus on video element
 */
function setupTapToFocus(video) {
  video.addEventListener('click', async (e) => {
    const rect = video.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Show focus indicator at tap location
    showFocusIndicator(x, y, rect);
    
    // Try to focus camera (if browser supports it)
    try {
      const stream = video.srcObject;
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities();
      
      if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
        await track.applyConstraints({
          advanced: [{ focusMode: 'continuous' }]
        });
      }
    } catch (err) {
      console.log('Manual focus not supported:', err);
    }
  });
}

/**
 * Show focus indicator at tap location
 */
function showFocusIndicator(x, y, rect) {
  const container = document.getElementById('barcodeScannerContainer');
  
  // Remove old indicator
  const oldIndicator = container.querySelector('.focus-indicator');
  if (oldIndicator) {
    oldIndicator.remove();
  }
  
  // Create new indicator
  const indicator = document.createElement('div');
  indicator.className = 'focus-indicator';
  indicator.style.left = x + 'px';
  indicator.style.top = y + 'px';
  container.appendChild(indicator);
  
  // Remove after animation
  setTimeout(() => indicator.remove(), 1000);
}

/**
 * Flash visual feedback when barcode detected
 */
function flashBarcodeDetection(isValid) {
  const container = document.getElementById('barcodeScannerContainer');
  const overlay = document.createElement('div');
  overlay.className = isValid ? 'barcode-flash-success' : 'barcode-flash-warning';
  container.appendChild(overlay);
  
  setTimeout(() => overlay.remove(), 300);
}

/**
 * Update status message
 */
function updateStatus(message, type = 'info') {
  const statusEl = document.getElementById('barcodeStatus');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = `barcode-status-${type}`;
  }
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
  videoElement = null;
  Quagga.stop();
}
