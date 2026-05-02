/**
 * Export system for QR code images.
 * Provides PNG export with DPI metadata, SVG export, download,
 * clipboard copy, and native share functionality.
 * @module export
 */

/**
 * Export the rendered QR code canvas as a PNG Blob with embedded DPI metadata.
 *
 * The function creates an offscreen canvas at the specified size, copies the
 * source canvas content, converts to PNG, and inserts a pHYs chunk for
 * print-quality DPI (default 300).
 *
 * @param {HTMLCanvasElement} canvas - Source canvas (already rendered at the right size)
 * @param {Object} options - Export options
 * @param {number} options.size - Output pixel dimension
 * @param {number} [options.dpi=300] - DPI for the pHYs chunk
 * @param {boolean} options.transparentBackground - Whether background is transparent
 * @returns {Promise<Blob>} PNG blob with DPI metadata
 */
export async function exportPNG(canvas, options) {
  const { size, dpi = 300, transparentBackground } = options;

  // 1. Create offscreen canvas at the specified size
  const offscreen = document.createElement('canvas');
  offscreen.width = size;
  offscreen.height = size;
  const ctx = offscreen.getContext('2d');

  // 2. Copy from source canvas
  if (transparentBackground) {
    ctx.clearRect(0, 0, size, size);
  }
  ctx.drawImage(canvas, 0, 0, size, size);

  // 3. Get PNG blob
  const blob = await new Promise((resolve, reject) => {
    offscreen.toBlob((b) => {
      if (b) {
        resolve(b);
      } else {
        reject(new Error('Failed to create PNG blob'));
      }
    }, 'image/png');
  });

  // 4. Embed pHYs chunk for DPI
  const arrayBuffer = await blob.arrayBuffer();
  const modifiedBuffer = insertPHYsChunk(arrayBuffer, dpi);

  return new Blob([modifiedBuffer], { type: 'image/png' });
}

/**
 * Insert a pHYs chunk into a PNG ArrayBuffer after the IHDR chunk.
 * The pHYs chunk specifies pixels-per-unit for print resolution.
 *
 * PNG chunk structure: 4 bytes length + 4 bytes type + data + 4 bytes CRC
 * pHYs chunk: 9 bytes data (4 ppuX + 4 ppuY + 1 unit)
 *
 * @param {ArrayBuffer} pngBuffer - Original PNG data
 * @param {number} dpi - Desired DPI (e.g. 300)
 * @returns {ArrayBuffer} Modified PNG with pHYs chunk
 */
function insertPHYsChunk(pngBuffer, dpi) {
  const src = new Uint8Array(pngBuffer);

  // PNG signature is 8 bytes
  // IHDR chunk starts at offset 8: 4 (length) + 4 (type) + 13 (data) + 4 (CRC) = 25 bytes
  // So IHDR ends at offset 8 + 25 = 33
  const ihdrEnd = 33;

  // Build the pHYs chunk
  // Pixels per meter = dpi * 39.3701
  const ppm = Math.round(dpi * 39.3701);

  // pHYs chunk data: 4 bytes X ppm + 4 bytes Y ppm + 1 byte unit (1 = meter)
  const physData = new Uint8Array(9);
  const physView = new DataView(physData.buffer);
  physView.setUint32(0, ppm); // X pixels per unit
  physView.setUint32(4, ppm); // Y pixels per unit
  physData[8] = 1; // Unit: meter

  // Full chunk: 4 (length) + 4 (type "pHYs") + 9 (data) + 4 (CRC) = 21 bytes
  const chunkLength = 9;
  const fullChunk = new Uint8Array(4 + 4 + chunkLength + 4);
  const chunkView = new DataView(fullChunk.buffer);

  // Length (4 bytes, big-endian)
  chunkView.setUint32(0, chunkLength);

  // Type: "pHYs" (4 bytes)
  fullChunk[4] = 0x70; // p
  fullChunk[5] = 0x48; // H
  fullChunk[6] = 0x59; // Y
  fullChunk[7] = 0x73; // s

  // Data (9 bytes)
  fullChunk.set(physData, 8);

  // CRC over type + data
  const crcData = fullChunk.slice(4, 4 + 4 + chunkLength);
  const crc = crc32(crcData);
  chunkView.setUint32(4 + 4 + chunkLength, crc);

  // Assemble: PNG header + IHDR + pHYs + rest
  const result = new Uint8Array(src.length + fullChunk.length);
  result.set(src.slice(0, ihdrEnd), 0);
  result.set(fullChunk, ihdrEnd);
  result.set(src.slice(ihdrEnd), ihdrEnd + fullChunk.length);

  return result.buffer;
}

/**
 * CRC-32 lookup table for PNG chunk CRC calculation.
 * @type {Uint32Array}
 */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) {
        c = 0xEDB88320 ^ (c >>> 1);
      } else {
        c = c >>> 1;
      }
    }
    table[n] = c;
  }
  return table;
})();

/**
 * Compute CRC-32 for a Uint8Array (used for PNG chunk CRC).
 *
 * @param {Uint8Array} data
 * @returns {number} CRC-32 value (unsigned 32-bit integer)
 */
function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Wrap an SVG markup string in a Blob with the correct MIME type.
 *
 * @param {string} svgString - SVG markup
 * @returns {Blob} SVG blob with type 'image/svg+xml'
 */
export function exportSVG(svgString) {
  return new Blob([svgString], { type: 'image/svg+xml' });
}

/**
 * Trigger a file download in the browser.
 * Creates a temporary anchor element, sets the download attribute,
 * clicks it, and revokes the object URL.
 *
 * @param {Blob} blob - File data
 * @param {string} filename - Suggested filename for the download
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generate a filesystem-safe filename for QR code exports.
 * Uses the current ISO 8601 timestamp with colons and dots replaced by hyphens.
 *
 * @param {string} format - File extension ('png' or 'svg')
 * @returns {string} Filename like 'qrcode-2025-01-15T10-30-00-000Z.png'
 */
export function generateFilename(format) {
  return `qrcode-${new Date().toISOString().replace(/[:.]/g, '-')}.${format}`;
}

/**
 * Copy the QR code canvas as a PNG image to the system clipboard.
 * Requires a secure context (HTTPS) and Clipboard API support.
 *
 * @param {HTMLCanvasElement} canvas - Canvas with the rendered QR code
 * @returns {Promise<void>}
 * @throws {Error} If the Clipboard API is not supported
 */
export async function copyToClipboard(canvas) {
  if (!navigator.clipboard?.write) {
    throw new Error('Clipboard not supported');
  }

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) {
        resolve(b);
      } else {
        reject(new Error('Failed to create image blob for clipboard'));
      }
    }, 'image/png');
  });

  await navigator.clipboard.write([
    new ClipboardItem({ 'image/png': blob }),
  ]);
}

/**
 * Share the QR code via the native OS share menu using the Web Share API.
 * Only available on supported browsers/platforms.
 *
 * @param {Blob} blob - QR code image blob
 * @param {string} filename - Filename for the shared file
 * @returns {Promise<void>}
 * @throws {Error} If the Web Share API is not available
 */
export async function shareQRCode(blob, filename) {
  if (!navigator.share) {
    throw new Error('Share not supported');
  }

  const file = new File([blob], filename, { type: blob.type || 'image/png' });
  await navigator.share({
    files: [file],
    title: 'QR Code',
  });
}
