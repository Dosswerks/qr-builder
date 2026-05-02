/**
 * Scan validation module.
 * Evaluates QR code designs for scannability based on contrast ratio,
 * logo area coverage, quiet zone size, and error correction level.
 * @module scan-validator
 */

/**
 * @typedef {'ok' | 'at-risk' | 'unscannable'} ScanStatus
 *
 * @typedef {Object} ScanValidationResult
 * @property {ScanStatus} status
 * @property {string[]} warnings
 */

/**
 * Threshold constants for scan validation decisions.
 * @type {Object}
 */
export const SCAN_THRESHOLDS = {
  /** Minimum contrast ratio — below this the QR code is unscannable */
  MIN_CONTRAST_RATIO: 3.0,
  /** Contrast ratio warning threshold — between MIN and this is at-risk */
  CONTRAST_WARNING_RATIO: 4.5,
  /** Minimum recommended quiet zone in modules */
  MIN_QUIET_ZONE_MODULES: 4,
  /** Maximum logo area as a fraction of QR area — above this is unscannable */
  MAX_LOGO_AREA_PERCENT: 0.30,
  /** Logo area warning threshold — above this with low EC is at-risk */
  LOGO_AREA_WARNING_PERCENT: 0.20,
};

/**
 * Parse a hex color string to RGB components.
 * Supports 3-digit (#RGB) and 6-digit (#RRGGBB) hex formats.
 * @param {string} hex - Hex color string (e.g., '#FF0000' or '#F00')
 * @returns {{ r: number, g: number, b: number }} RGB values in 0-255 range
 */
function parseHexColor(hex) {
  let cleaned = hex.replace(/^#/, '');

  // Expand 3-digit hex to 6-digit
  if (cleaned.length === 3) {
    cleaned = cleaned[0] + cleaned[0] + cleaned[1] + cleaned[1] + cleaned[2] + cleaned[2];
  }

  const num = parseInt(cleaned, 16);
  return {
    r: (num >> 16) & 0xff,
    g: (num >> 8) & 0xff,
    b: num & 0xff,
  };
}

/**
 * Linearize an sRGB channel value for luminance calculation.
 * Converts from gamma-corrected sRGB (0-255) to linear light (0-1).
 * @param {number} channel - sRGB channel value (0-255)
 * @returns {number} Linear channel value (0-1)
 */
function linearize(channel) {
  const srgb = channel / 255;
  return srgb <= 0.04045
    ? srgb / 12.92
    : Math.pow((srgb + 0.055) / 1.055, 2.4);
}

/**
 * Compute the relative luminance of a color per WCAG 2.1.
 * @param {{ r: number, g: number, b: number }} rgb - RGB color components (0-255)
 * @returns {number} Relative luminance (0-1)
 */
function relativeLuminance(rgb) {
  const r = linearize(rgb.r);
  const g = linearize(rgb.g);
  const b = linearize(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Compute the WCAG 2.1 contrast ratio between two hex colors.
 * The ratio ranges from 1:1 (identical) to 21:1 (black vs white).
 * @param {string} color1 - First hex color string (e.g., '#000000')
 * @param {string} color2 - Second hex color string (e.g., '#FFFFFF')
 * @returns {number} Contrast ratio (1 to 21)
 */
export function contrastRatio(color1, color2) {
  const rgb1 = parseHexColor(color1);
  const rgb2 = parseHexColor(color2);

  const l1 = relativeLuminance(rgb1);
  const l2 = relativeLuminance(rgb2);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Validate the scannability of a QR code configuration.
 * Evaluates contrast ratio, logo area coverage, quiet zone size,
 * and error correction level against defined thresholds.
 *
 * Status priority: unscannable > at-risk > ok
 *
 * @param {Object} config
 * @param {string} config.foregroundColor - Hex color for QR modules
 * @param {string} config.backgroundColor - Hex color for QR background
 * @param {number} config.logoAreaPercent - Logo area as fraction of QR area (0-1)
 * @param {number} config.quietZoneModules - Number of quiet zone modules
 * @param {string} config.errorCorrectionLevel - 'L' | 'M' | 'Q' | 'H'
 * @returns {ScanValidationResult} Validation result with status and warnings
 */
export function validateScannability(config) {
  const {
    foregroundColor,
    backgroundColor,
    logoAreaPercent,
    quietZoneModules,
    errorCorrectionLevel,
  } = config;

  /** @type {string[]} */
  const warnings = [];
  let hasUnscannable = false;
  let hasAtRisk = false;

  // --- Contrast ratio checks ---
  const ratio = contrastRatio(foregroundColor, backgroundColor);
  const roundedRatio = Math.round(ratio * 10) / 10;

  if (ratio < SCAN_THRESHOLDS.MIN_CONTRAST_RATIO) {
    hasUnscannable = true;
    warnings.push(`Low contrast ratio (${roundedRatio}:1)`);
  } else if (ratio < SCAN_THRESHOLDS.CONTRAST_WARNING_RATIO) {
    hasAtRisk = true;
    warnings.push(`Contrast ratio (${roundedRatio}:1) may cause scanning issues`);
  }

  // --- Logo area checks ---
  if (logoAreaPercent > SCAN_THRESHOLDS.MAX_LOGO_AREA_PERCENT) {
    hasUnscannable = true;
    warnings.push('Logo covers more than 30% of QR code');
  } else if (
    logoAreaPercent > SCAN_THRESHOLDS.LOGO_AREA_WARNING_PERCENT &&
    errorCorrectionLevel !== 'H'
  ) {
    hasAtRisk = true;
    const pct = Math.round(logoAreaPercent * 100);
    warnings.push(`Logo covers ${pct}% — consider using Error Correction H`);
  }

  // --- Quiet zone checks ---
  if (quietZoneModules === 0) {
    hasUnscannable = true;
    warnings.push('No quiet zone — QR code may not scan');
  } else if (quietZoneModules < SCAN_THRESHOLDS.MIN_QUIET_ZONE_MODULES) {
    hasAtRisk = true;
    warnings.push('Quiet zone below recommended 4 modules');
  }

  // --- Determine overall status (worst wins) ---
  /** @type {ScanStatus} */
  let status = 'ok';
  if (hasUnscannable) {
    status = 'unscannable';
  } else if (hasAtRisk) {
    status = 'at-risk';
  }

  return { status, warnings };
}
