/**
 * QR code utilities for generating and scanning QR codes
 * @module qrcode
 */

import QRCode from 'qrcode';
import { Html5QrcodeScanner } from 'html5-qrcode';
import * as ZXing from 'html5-qrcode/third_party/zxing-js.umd';

/**
 * Error correction level for QR codes
 * @type {'L' | 'M' | 'Q' | 'H'}
 */
const errorCorrectionLevel = 'M';

/**
 * Generate a QR code from data
 * @param {string} data - The data to encode in the QR code
 * @param {HTMLElement} container - The container element to render the QR code in
 * @returns {Promise<void>}
 */
export async function generateQRCode(data, container) {
  try {
    // Clear the container
    container.innerHTML = '';

    // Create a canvas element
    const canvas = document.createElement('canvas');

    // Set explicit size constraints
    canvas.style.maxWidth = '100%';
    canvas.style.height = 'auto';

    // Add the canvas to the container
    container.appendChild(canvas);

    // Generate QR code on the canvas with better options
    await QRCode.toCanvas(canvas, data, {
      width: 300,
      margin: 1,
      errorCorrectionLevel,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  } catch (error) {
    console.error('Error generating QR code:', error);

    // Show error message in container
    container.innerHTML = '<p style="color: red;">Error generating QR code</p>';
  }
}

/**
 * Initialize a QR code scanner
 * @param {string} elementId - The ID of the element to render the scanner in
 * @param {Function} onSuccess - Callback function when a QR code is successfully scanned
 * @returns {Html5QrcodeScanner} The scanner instance
 */
export function initQRScanner(elementId, onSuccess) {
  // Initialize the QR code scanner with better configuration
  const html5QrcodeScanner = new Html5QrcodeScanner(
    elementId,
    {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      rememberLastUsedCamera: true,
      showTorchButtonIfSupported: true,
      formatsToSupport: [0], // QR_CODE only
      aspectRatio: 1.0,
    },
    /* verbose= */ false
  );

  // Render the scanner UI
  // @ts-ignore
  html5QrcodeScanner.render(onSuccess, errorMessage => {
    // @ts-ignore
    if (errorMessage instanceof ZXing.NotFoundException) {
      console.warn(`QR Code scanning error: ${errorMessage}`);
    }
  });

  // Apply custom styling to fix UI issues
  setTimeout(() => {
    const scannerContainer = document.getElementById(elementId);
    if (scannerContainer) {
      // Fix any overlapping elements
      const scannerElements = scannerContainer.querySelectorAll('div');
      scannerElements.forEach(element => {
        element.style.maxWidth = '100%';
        element.style.boxSizing = 'border-box';
      });

      // Fix select elements
      const selectElements = scannerContainer.querySelectorAll('select');
      selectElements.forEach(select => {
        select.style.maxWidth = '100%';
        select.style.boxSizing = 'border-box';
      });
    }
  }, 500);

  return html5QrcodeScanner;
}

/**
 * Clear a QR code scanner instance
 * @param {Html5QrcodeScanner} scanner - The scanner instance to clear
 */
export function clearQRScanner(scanner) {
  if (scanner) {
    scanner.clear();
  }
}
