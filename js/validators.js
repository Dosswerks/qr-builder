/**
 * Input validation and capacity checking for all QR code data types.
 * Each validator returns { valid: boolean, error?: string }.
 * @module validators
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether the input is valid
 * @property {string} [error] - User-facing error message when invalid
 */

/**
 * Validate a URL input. Requires http:// or https:// scheme.
 * @param {string} input - URL string to validate
 * @returns {ValidationResult}
 */
export function validateURL(input) {
  if (!input || typeof input !== 'string' || input.trim() === '') {
    return { valid: false, error: 'URL is required' };
  }

  const trimmed = input.trim();

  // Must start with http:// or https://
  if (!/^https?:\/\//i.test(trimmed)) {
    return { valid: false, error: 'URL must start with http:// or https://' };
  }

  try {
    new URL(trimmed);
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Validate a phone number input.
 * Allows digits, spaces, hyphens, parentheses, and an optional leading +.
 * @param {string} input - Phone number string to validate
 * @returns {ValidationResult}
 */
export function validatePhone(input) {
  if (!input || typeof input !== 'string' || input.trim() === '') {
    return { valid: false, error: 'Phone number is required' };
  }

  const trimmed = input.trim();

  // Only allow digits, spaces, hyphens, parentheses, and optional leading +
  if (!/^\+?[\d\s\-()]+$/.test(trimmed)) {
    return { valid: false, error: 'Phone number can only contain digits, spaces, hyphens, parentheses, and an optional leading +' };
  }

  return { valid: true };
}

/**
 * Validate an email address input.
 * Checks for local-part@domain format.
 * @param {string} input - Email address to validate
 * @returns {ValidationResult}
 */
export function validateEmail(input) {
  if (!input || typeof input !== 'string' || input.trim() === '') {
    return { valid: false, error: 'Email address is required' };
  }

  const trimmed = input.trim();

  // Basic email regex: local-part@domain
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Invalid email format. Expected: local-part@domain' };
  }

  return { valid: true };
}

/**
 * Validate SMS input (phone number and optional body).
 * Phone portion uses the same rules as validatePhone.
 * @param {string} phone - Phone number for SMS
 * @param {string} body - Message body (freeform text)
 * @returns {ValidationResult}
 */
export function validateSMS(phone, body) {
  const phoneResult = validatePhone(phone);
  if (!phoneResult.valid) {
    return { valid: false, error: phoneResult.error };
  }

  // Body is freeform — no validation needed beyond existence check
  // (body can be empty for SMS)
  return { valid: true };
}

/**
 * Validate Wi-Fi credentials.
 * Requires non-empty SSID and valid encryption type.
 * @param {string} ssid - Network name
 * @param {string} password - Network password
 * @param {string} encryption - Encryption type: 'WPA', 'WEP', or 'nopass'
 * @returns {ValidationResult}
 */
export function validateWiFi(ssid, password, encryption) {
  if (!ssid || typeof ssid !== 'string' || ssid.trim() === '') {
    return { valid: false, error: 'SSID (network name) is required' };
  }

  const validEncryptions = ['WPA', 'WEP', 'nopass'];
  if (!validEncryptions.includes(encryption)) {
    return { valid: false, error: 'Encryption must be WPA, WEP, or nopass' };
  }

  return { valid: true };
}

/**
 * Validate vCard contact fields.
 * Requires at least firstName or lastName to be non-empty.
 * @param {Object} fields - vCard fields
 * @param {string} [fields.firstName] - First name
 * @param {string} [fields.lastName] - Last name
 * @param {string} [fields.phone] - Phone number
 * @param {string} [fields.email] - Email address
 * @param {string} [fields.organization] - Organization name
 * @param {string} [fields.address] - Street address
 * @returns {ValidationResult}
 */
export function validateVCard(fields) {
  if (!fields || typeof fields !== 'object') {
    return { valid: false, error: 'Contact information is required' };
  }

  const firstName = (fields.firstName || '').trim();
  const lastName = (fields.lastName || '').trim();

  if (!firstName && !lastName) {
    return { valid: false, error: 'At least a first name or last name is required' };
  }

  return { valid: true };
}

/**
 * Validate geographic coordinates.
 * Latitude must be in [-90, 90], longitude in [-180, 180].
 * @param {string|number} lat - Latitude value
 * @param {string|number} lng - Longitude value
 * @returns {ValidationResult}
 */
export function validateGeo(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);

  if (lat === '' || lat === null || lat === undefined || isNaN(latitude)) {
    return { valid: false, error: 'Latitude is required and must be a number' };
  }

  if (lng === '' || lng === null || lng === undefined || isNaN(longitude)) {
    return { valid: false, error: 'Longitude is required and must be a number' };
  }

  if (latitude < -90 || latitude > 90) {
    return { valid: false, error: 'Latitude must be between -90 and 90' };
  }

  if (longitude < -180 || longitude > 180) {
    return { valid: false, error: 'Longitude must be between -180 and 180' };
  }

  return { valid: true };
}

/**
 * Validate plain text input.
 * Checks that input is non-empty and within the specified maximum length.
 * @param {string} input - Text to validate
 * @param {number} maxLength - Maximum allowed character count
 * @returns {ValidationResult}
 */
export function validatePlainText(input, maxLength) {
  if (!input || typeof input !== 'string' || input.trim() === '') {
    return { valid: false, error: 'Text input is required' };
  }

  if (input.length > maxLength) {
    return { valid: false, error: `Text exceeds maximum length of ${maxLength} characters (current: ${input.length})` };
  }

  return { valid: true };
}

/**
 * QR version 40 maximum character capacities by encoding mode and EC level.
 * @type {Object.<string, Object.<string, number>>}
 */
const CAPACITY_TABLE = {
  numeric: { L: 7089, M: 5596, Q: 3993, H: 3057 },
  alphanumeric: { L: 4296, M: 3391, Q: 2420, H: 1852 },
  byte: { L: 2953, M: 2331, Q: 1663, H: 1273 },
};

/**
 * Get the maximum character capacity for a given encoding mode and error correction level.
 * Uses QR version 40 (maximum) capacities.
 * @param {'numeric' | 'alphanumeric' | 'byte'} mode - Encoding mode
 * @param {'L' | 'M' | 'Q' | 'H'} ecLevel - Error correction level
 * @returns {number} Maximum character count, or 0 if mode/level is invalid
 */
export function getMaxCapacity(mode, ecLevel) {
  const modeCapacities = CAPACITY_TABLE[mode];
  if (!modeCapacities) {
    return 0;
  }

  return modeCapacities[ecLevel] || 0;
}

/**
 * Determine the encoding mode for a given input string.
 * Numeric-only → 'numeric', alphanumeric charset → 'alphanumeric', else → 'byte'.
 * @param {string} input - Input string to analyze
 * @returns {'numeric' | 'alphanumeric' | 'byte'}
 */
function detectEncodingMode(input) {
  if (/^\d+$/.test(input)) {
    return 'numeric';
  }

  // QR alphanumeric charset: 0-9, A-Z, space, $, %, *, +, -, ., /, :
  if (/^[0-9A-Z $%*+\-./:]+$/.test(input)) {
    return 'alphanumeric';
  }

  return 'byte';
}

/**
 * Validate that the input data fits within QR encoding capacity limits.
 * Determines the encoding mode automatically and checks against the
 * maximum capacity for the given error correction level.
 * @param {string} input - Formatted data string to check
 * @param {'L' | 'M' | 'Q' | 'H'} ecLevel - Error correction level
 * @returns {ValidationResult}
 */
export function validateCapacity(input, ecLevel) {
  if (!input || typeof input !== 'string') {
    return { valid: false, error: 'Input data is required' };
  }

  const mode = detectEncodingMode(input);
  const maxCapacity = getMaxCapacity(mode, ecLevel);

  if (maxCapacity === 0) {
    return { valid: false, error: 'Invalid encoding mode or error correction level' };
  }

  if (input.length > maxCapacity) {
    return {
      valid: false,
      error: `Data exceeds maximum capacity of ${maxCapacity} characters for ${mode} mode at EC level ${ecLevel} (current: ${input.length})`,
    };
  }

  return { valid: true };
}
