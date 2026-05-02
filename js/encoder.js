/**
 * QR encoding engine.
 * Wraps the `qrcode-generator` CDN library (available as global `qrcode` function)
 * to produce a QR matrix from input data.
 * @module encoder
 */

/**
 * @typedef {Object} QRMatrix
 * @property {number} size - Module count per side
 * @property {boolean[][]} modules - true = dark, false = light
 * @property {number} version - QR version (1-40)
 * @property {string} errorCorrectionLevel
 * @property {string} encodingMode - The mode selected for this encode
 */

/**
 * Characters allowed in QR alphanumeric mode (ISO 18004).
 * 0-9, A-Z, space, and the symbols: $ % * + - . / :
 * @type {Set<string>}
 */
const ALPHANUMERIC_CHARS = new Set(
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:'.split('')
);

/**
 * Selects the optimal encoding mode for the given data.
 * Numeric-only → 'numeric', alphanumeric charset → 'alphanumeric', else → 'byte'.
 * @param {string} data - The data string to analyze
 * @returns {string} The optimal encoding mode: 'numeric', 'alphanumeric', or 'byte'
 */
export function selectOptimalMode(data) {
  if (!data || typeof data !== 'string' || data.length === 0) {
    return 'byte';
  }

  // Check if all characters are digits (numeric mode)
  const isNumeric = /^\d+$/.test(data);
  if (isNumeric) {
    return 'numeric';
  }

  // Check if all characters are in the alphanumeric charset
  const isAlphanumeric = data.split('').every((ch) => ALPHANUMERIC_CHARS.has(ch));
  if (isAlphanumeric) {
    return 'alphanumeric';
  }

  return 'byte';
}

/**
 * Encode data into a QR matrix using the qrcode-generator library.
 * The library is loaded from CDN and available as the global `qrcode` function.
 *
 * @param {Object} options
 * @param {string} options.data - The data string to encode
 * @param {string} options.errorCorrectionLevel - 'L' | 'M' | 'Q' | 'H'
 * @returns {QRMatrix} The encoded QR matrix with metadata
 * @throws {Error} If encoding fails (data too large, invalid input, library unavailable)
 */
export function encode({ data, errorCorrectionLevel }) {
  try {
    if (!data || typeof data !== 'string') {
      throw new Error('Data must be a non-empty string');
    }

    const validLevels = ['L', 'M', 'Q', 'H'];
    if (!validLevels.includes(errorCorrectionLevel)) {
      throw new Error(
        `Invalid error correction level "${errorCorrectionLevel}". Must be one of: L, M, Q, H`
      );
    }

    if (typeof window.qrcode !== 'function') {
      throw new Error(
        'QR code library not loaded. Ensure qrcode-generator is included via CDN.'
      );
    }

    const typeNumber = 0; // auto-detect version
    const qr = window.qrcode(typeNumber, errorCorrectionLevel);
    qr.addData(data);
    qr.make();

    const moduleCount = qr.getModuleCount();

    // Extract the module matrix into a 2D boolean array
    const modules = [];
    for (let row = 0; row < moduleCount; row++) {
      const rowData = [];
      for (let col = 0; col < moduleCount; col++) {
        rowData.push(qr.isDark(row, col));
      }
      modules.push(rowData);
    }

    // Derive version from module count: version = (moduleCount - 17) / 4
    const version = (moduleCount - 17) / 4;

    const encodingMode = selectOptimalMode(data);

    return {
      size: moduleCount,
      modules,
      version,
      errorCorrectionLevel,
      encodingMode,
    };
  } catch (error) {
    throw new Error(`QR encoding failed: ${error.message}`);
  }
}
