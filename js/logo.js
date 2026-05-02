/**
 * Logo processing and placement module.
 * Handles logo file validation, loading, and placement calculations
 * for embedding logos in QR codes.
 * @module logo
 */

import { validateFileType, validateFileMagicBytes, sanitizeSVG } from './security.js';

/**
 * Maximum allowed dimension (width or height) for uploaded logo images.
 * @type {number}
 */
export const MAX_LOGO_DIMENSION = 2048;

/**
 * Maximum allowed file size for uploaded logos (2MB).
 * @type {number}
 */
const MAX_FILE_SIZE = 2 * 1024 * 1024;

/**
 * Allowed MIME types for logo uploads.
 * @type {string[]}
 */
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'];

/**
 * Process an uploaded logo file.
 * Validates file type, file size, magic bytes, and image dimensions.
 * For SVG files, sanitizes content to remove executable code before loading.
 *
 * @param {File} file - The uploaded file to process
 * @returns {Promise<{ image: HTMLImageElement, width: number, height: number }>}
 * @throws {Error} If validation fails at any step
 */
export async function processLogo(file) {
  // 1. Check file type
  const typeResult = validateFileType(file, ALLOWED_TYPES);
  if (!typeResult.valid) {
    throw new Error(
      `Unsupported format. Accepted: PNG, JPEG, SVG`
    );
  }

  // 2. Check file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `File exceeds 2MB maximum size`
    );
  }

  // 3. Read file as ArrayBuffer and validate magic bytes
  const buffer = await file.arrayBuffer();
  const magicResult = validateFileMagicBytes(buffer);
  if (!magicResult.valid) {
    throw new Error(
      'File content does not match expected image format'
    );
  }

  // 4. Create the image source URL
  let imageUrl;
  const isSVG = file.type === 'image/svg+xml';

  if (isSVG) {
    // Read SVG as text, sanitize, then create blob URL from sanitized content
    const text = new TextDecoder('utf-8').decode(buffer);
    const sanitized = sanitizeSVG(text);
    if (!sanitized) {
      throw new Error('SVG file could not be sanitized — it may be malformed');
    }
    const blob = new Blob([sanitized], { type: 'image/svg+xml' });
    imageUrl = URL.createObjectURL(blob);
  } else {
    // For PNG/JPEG, create blob URL directly from the file
    imageUrl = URL.createObjectURL(file);
  }

  // 5. Load image and validate dimensions
  try {
    const image = await loadImage(imageUrl);

    // 6. Check dimensions
    if (image.naturalWidth > MAX_LOGO_DIMENSION || image.naturalHeight > MAX_LOGO_DIMENSION) {
      throw new Error(
        `Image dimensions exceed ${MAX_LOGO_DIMENSION}×${MAX_LOGO_DIMENSION} pixels maximum`
      );
    }

    // 7. Return processed result
    return {
      image,
      width: image.naturalWidth,
      height: image.naturalHeight,
    };
  } catch (error) {
    // Clean up the object URL on failure
    URL.revokeObjectURL(imageUrl);
    throw error;
  }
}

/**
 * Load an image from a URL and wait for it to finish loading.
 * @param {string} src - The image source URL
 * @returns {Promise<HTMLImageElement>} The loaded image element
 */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image'));
    image.src = src;
  });
}

/**
 * Calculate centered logo placement within a QR code.
 * Scales the logo to fit within the maximum allowed area while
 * maintaining aspect ratio, then centers it with padding.
 *
 * @param {number} qrSize - The QR code size in pixels
 * @param {number} logoWidth - The natural width of the logo image
 * @param {number} logoHeight - The natural height of the logo image
 * @param {number} [maxAreaPercent=0.30] - Maximum logo area as a fraction of QR area
 * @returns {{ x: number, y: number, scaledWidth: number, scaledHeight: number, padding: number }}
 */
export function calculateLogoPlacement(qrSize, logoWidth, logoHeight, maxAreaPercent = 0.30) {
  // 1. Compute max logo area
  const maxArea = qrSize * qrSize * maxAreaPercent;

  // 2. Compute logo aspect ratio
  const aspectRatio = logoWidth / logoHeight;

  // 3. Scale logo to fit within max area while maintaining aspect ratio
  // area = scaledWidth * scaledHeight
  // scaledWidth = aspectRatio * scaledHeight
  // area = aspectRatio * scaledHeight^2
  // scaledHeight = sqrt(area / aspectRatio)
  let scaledHeight = Math.sqrt(maxArea / aspectRatio);
  let scaledWidth = aspectRatio * scaledHeight;

  // Ensure we don't scale up beyond original dimensions
  if (scaledWidth > logoWidth || scaledHeight > logoHeight) {
    scaledWidth = logoWidth;
    scaledHeight = logoHeight;
  }

  // 4. Add padding (8px or 2% of qrSize, whichever is larger)
  const padding = Math.max(8, qrSize * 0.02);

  // 5. Center in QR code
  const x = (qrSize - scaledWidth) / 2;
  const y = (qrSize - scaledHeight) / 2;

  return {
    x,
    y,
    scaledWidth,
    scaledHeight,
    padding,
  };
}
