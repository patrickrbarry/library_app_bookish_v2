/**
 * BOOKISH LIBRARY - BARCODE SCANNER
 * Client-side barcode detection with visual feedback and tap-to-focus
 */

let detectedBarcodes = new Set();
let detectionTimer = null;
let videoElement = null;
let scanLocked = false; // prevents processing after first valid ISBN

/**
 * Start barcode scanner with multi-barcode detection
 */
export function startBarcodeScanner(containerId, onDetected, onError) {
  // Reset detection state
  detectedBarcodes.clear();
  scanLocked = false;
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
    frequency: 5,
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
    // If we already locked in a valid ISBN, ignore further detections
    if (scanLocked) return;

    // Confidence check — reject noisy/low-quality reads
    const decodedCodes = result.codeResult.decodedCodes;
    if (decodedCodes && decodedCodes.length > 0) {
      const errors = decodedCodes
        .filter(d => d.error !== undefined)
        .map(d => d.error);
      if (errors.length > 0) {
        const avgError = errors.reduce((a, b) => a + b, 0) / errors.length;
        if (avgError > 0.25) {
          // Low confidence — silently ignore (no flash)
          return;
        }
      }
    }

    const code = result.codeResult.code;
    console.log("Barcode detected (high confidence):", code);

    // Remove any hyphens/spaces
    const cleanCode = code.replace(/[-\s]/g, '');

    // Only accept valid ISBN lengths (10 or 13 digits)
    if (cleanCode.length === 10 || cleanCode.length === 13) {
      console.log("✅ Valid ISBN detected:", cleanCode);

      // Lock scanning — stop accepting new detections
      scanLocked = true;
      detectedBarcodes.add(cleanCode);

      // Visual feedback - flash green
      flashBarcodeDetection(true);

      // Update status with the actual ISBN
      updateStatus(`✅ SCANNED: ${cleanCode}`, 'success');

      // Stop listening for more detections
      Quagga.offDetected();

      // Brief delay to show success, then process
      detectionTimer = setTimeout(() => {
        console.log(`Processing ISBN: ${cleanCode}`);
        updateStatus('🔍 Looking up book...', 'info');
        onDetected(Array.from(detectedBarcodes));
      }, 1500);

    } else {
      console.log("Invalid ISBN length, ignoring:", cleanCode);
      // Flash yellow for invalid barcode (but don't spam — throttle)
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
  scanLocked = false;
  videoElement = null;
  Quagga.offDetected();
  Quagga.stop();
}
