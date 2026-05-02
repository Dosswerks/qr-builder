/**
 * Data type formatters for QR code encoding.
 * Each formatter converts validated input into the QR-encodable protocol string.
 * @module formatters
 */

/**
 * Format a URL for QR encoding. Passthrough — returns the URL as-is.
 * @param {string} url - Validated URL string
 * @returns {string} The URL unchanged
 */
export function formatURL(url) {
  return url;
}

/**
 * Format a phone number for QR encoding.
 * Produces a tel: URI with spaces stripped.
 * @param {string} phone - Validated phone number
 * @returns {string} Formatted tel: URI (e.g., "tel:+15550123")
 */
export function formatPhone(phone) {
  return `tel:${phone.replace(/\s/g, '')}`;
}

/**
 * Format an email address for QR encoding.
 * Produces a mailto: URI.
 * @param {string} email - Validated email address
 * @returns {string} Formatted mailto: URI (e.g., "mailto:name@example.com")
 */
export function formatEmail(email) {
  return `mailto:${email}`;
}

/**
 * Format an SMS message for QR encoding.
 * Produces an smsto: URI with phone spaces stripped.
 * @param {string} phone - Validated phone number
 * @param {string} body - Message body text
 * @returns {string} Formatted smsto: URI (e.g., "smsto:+15550123:Hello!")
 */
export function formatSMS(phone, body) {
  return `smsto:${phone.replace(/\s/g, '')}:${body}`;
}

/**
 * Escape special characters in a Wi-Fi field value.
 * The Wi-Fi QR format requires escaping: semicolons, commas, double quotes, colons, and backslashes.
 * @param {string} value - Raw field value
 * @returns {string} Escaped value
 */
function escapeWiFiField(value) {
  if (!value) return '';
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/"/g, '\\"')
    .replace(/:/g, '\\:');
}

/**
 * Format Wi-Fi credentials for QR encoding.
 * Produces a WIFI: protocol string with special characters escaped.
 * @param {Object} config - Wi-Fi configuration
 * @param {string} config.ssid - Network name
 * @param {string} config.password - Network password
 * @param {string} config.encryption - Encryption type: 'WPA', 'WEP', or 'nopass'
 * @returns {string} Formatted WIFI: string (e.g., "WIFI:T:WPA;S:MyNetwork;P:pass123;;")
 */
export function formatWiFi({ ssid, password, encryption }) {
  const escapedSSID = escapeWiFiField(ssid);
  const escapedPassword = escapeWiFiField(password);
  return `WIFI:T:${encryption};S:${escapedSSID};P:${escapedPassword};;`;
}

/**
 * Format vCard contact information for QR encoding.
 * Produces a vCard 3.0 format string. Only includes non-empty fields.
 * @param {Object} fields - Contact fields
 * @param {string} [fields.firstName] - First name
 * @param {string} [fields.lastName] - Last name
 * @param {string} [fields.phone] - Phone number
 * @param {string} [fields.email] - Email address
 * @param {string} [fields.organization] - Organization name
 * @param {string} [fields.address] - Street address
 * @returns {string} vCard 3.0 formatted string
 */
export function formatVCard(fields) {
  const firstName = (fields.firstName || '').trim();
  const lastName = (fields.lastName || '').trim();
  const phone = (fields.phone || '').trim();
  const email = (fields.email || '').trim();
  const organization = (fields.organization || '').trim();
  const address = (fields.address || '').trim();

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
  ];

  // N and FN are always included when we have a name
  lines.push(`N:${lastName};${firstName};;;`);

  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  lines.push(`FN:${fullName}`);

  if (phone) {
    lines.push(`TEL:${phone}`);
  }

  if (email) {
    lines.push(`EMAIL:${email}`);
  }

  if (organization) {
    lines.push(`ORG:${organization}`);
  }

  if (address) {
    lines.push(`ADR:;;${address};;;;`);
  }

  lines.push('END:VCARD');

  return lines.join('\n');
}

/**
 * Format geographic coordinates for QR encoding.
 * Produces a geo: URI.
 * @param {number|string} lat - Latitude
 * @param {number|string} lng - Longitude
 * @returns {string} Formatted geo: URI (e.g., "geo:40.7128,-74.006")
 */
export function formatGeo(lat, lng) {
  return `geo:${lat},${lng}`;
}

/**
 * Format plain text for QR encoding. Passthrough — returns the text as-is.
 * @param {string} text - Validated text string
 * @returns {string} The text unchanged
 */
export function formatPlainText(text) {
  return text;
}
