/**
 * Main application entry point for QR Builder.
 * Manages state, the render pipeline, event handling, and initialization.
 * Wires all modules together into a working application.
 * @module app
 */

import { sanitizeInput, detectMaliciousURL } from './security.js';
import { validateURL, validatePhone, validateEmail, validateSMS, validateWiFi, validateVCard, validateGeo, validatePlainText, validateCapacity } from './validators.js';
import { formatURL, formatPhone, formatEmail, formatSMS, formatWiFi, formatVCard, formatGeo, formatPlainText } from './formatters.js';
import { encode } from './encoder.js';
import { renderToCanvas, renderToSVGString } from './renderer.js';
import { exportPNG, exportSVG, downloadBlob, generateFilename, copyToClipboard, shareQRCode } from './export.js';
import { validateScannability } from './scan-validator.js';
import { processLogo } from './logo.js';
import * as ui from './ui.js';

// ---------------------------------------------------------------------------
// 1. State and Defaults
// ---------------------------------------------------------------------------

const DEFAULTS = {
  dataType: 'url',
  errorCorrectionLevel: 'M',
  foregroundColor: '#000000',
  backgroundColor: '#FFFFFF',
  transparentBackground: false,
  moduleStyle: 'square',
  cornerEyeStyle: 'square',
  outputSize: 512,
  quietZone: 4,
};

const state = {
  ...DEFAULTS,
  inputData: { type: 'url', url: '' },
  logo: null, // null or { file, image, width, height, areaPercent }
  isDirty: false,
};

// ---------------------------------------------------------------------------
// 2. Example Content
// ---------------------------------------------------------------------------

const EXAMPLE_CONTENT = {
  url: 'https://example.com',
  text: 'Hello, World!',
  phone: '+1-555-0123',
  email: 'name@example.com',
  sms: { number: '+1-555-0123', body: 'Hello!' },
  wifi: { ssid: 'MyNetwork', password: 'password123', encryption: 'WPA' },
  vcard: { firstName: 'Jane', lastName: 'Doe', phone: '+1-555-0123', email: 'jane@example.com', organization: 'Acme Inc', address: '123 Main St' },
  geo: { latitude: '40.7128', longitude: '-74.0060' },
};

// ---------------------------------------------------------------------------
// 3. QR Matrix Cache
// ---------------------------------------------------------------------------

let cachedMatrix = null;
let cachedMatrixKey = '';

// ---------------------------------------------------------------------------
// 4. Render Pipeline
// ---------------------------------------------------------------------------

/**
 * Core render pipeline called on every state change (debounced).
 * Sanitize → Validate → Format → Capacity Check → Encode → Render → Scan Validate → Update UI.
 */
function renderPipeline() {
  try {
    // 1. Read input data from DOM
    const inputData = ui.getInputData(state.dataType);
    state.inputData = inputData;

    // 2. Extract raw value(s) and sanitize text inputs
    let rawValue = '';
    switch (state.dataType) {
      case 'url':
        rawValue = sanitizeInput(inputData.url || '');
        break;
      case 'text':
        rawValue = sanitizeInput(inputData.text || '');
        break;
      case 'phone':
        rawValue = sanitizeInput(inputData.number || '');
        break;
      case 'email':
        rawValue = sanitizeInput(inputData.address || '');
        break;
      case 'sms':
        rawValue = sanitizeInput(inputData.number || '');
        break;
      case 'wifi':
        rawValue = sanitizeInput(inputData.ssid || '');
        break;
      case 'vcard':
        rawValue = sanitizeInput((inputData.fields && inputData.fields.firstName) || '');
        break;
      case 'geo':
        rawValue = inputData.latitude || '';
        break;
      default:
        rawValue = '';
    }

    // 3. If URL type, check for malicious URL
    if (state.dataType === 'url' && rawValue) {
      const malCheck = detectMaliciousURL(rawValue);
      if (malCheck.isMalicious) {
        ui.showToast(`Warning: ${malCheck.reason}`, 'warning');
      }
    }

    // 4. Validate input using the appropriate validator
    let validation;
    switch (state.dataType) {
      case 'url':
        validation = validateURL(rawValue);
        break;
      case 'text':
        validation = validatePlainText(rawValue, 2953);
        break;
      case 'phone':
        validation = validatePhone(rawValue);
        break;
      case 'email':
        validation = validateEmail(rawValue);
        break;
      case 'sms': {
        const smsPhone = sanitizeInput(inputData.number || '');
        const smsBody = sanitizeInput(inputData.body || '');
        validation = validateSMS(smsPhone, smsBody);
        break;
      }
      case 'wifi': {
        const ssid = sanitizeInput(inputData.ssid || '');
        const password = sanitizeInput(inputData.password || '');
        const encryption = inputData.encryption || 'WPA';
        validation = validateWiFi(ssid, password, encryption);
        break;
      }
      case 'vcard': {
        const fields = inputData.fields || {};
        const sanitizedFields = {
          firstName: sanitizeInput(fields.firstName || ''),
          lastName: sanitizeInput(fields.lastName || ''),
          phone: sanitizeInput(fields.phone || ''),
          email: sanitizeInput(fields.email || ''),
          organization: sanitizeInput(fields.organization || ''),
          address: sanitizeInput(fields.address || ''),
        };
        validation = validateVCard(sanitizedFields);
        break;
      }
      case 'geo':
        validation = validateGeo(inputData.latitude, inputData.longitude);
        break;
      default:
        validation = { valid: false, error: 'Unknown data type' };
    }

    // 5. If invalid: show error, show placeholder, disable actions, return
    if (!validation.valid) {
      ui.showValidationError(state.dataType, validation.error || 'Invalid input');
      ui.showPlaceholder(true);
      ui.setActionsEnabled(false);
      return;
    }

    // 6. If valid: clear error, format data
    ui.clearValidationError(state.dataType);

    let formattedData = '';
    switch (state.dataType) {
      case 'url':
        formattedData = formatURL(rawValue);
        break;
      case 'text':
        formattedData = formatPlainText(rawValue);
        break;
      case 'phone':
        formattedData = formatPhone(rawValue);
        break;
      case 'email':
        formattedData = formatEmail(rawValue);
        break;
      case 'sms': {
        const smsPhone = sanitizeInput(inputData.number || '');
        const smsBody = sanitizeInput(inputData.body || '');
        formattedData = formatSMS(smsPhone, smsBody);
        break;
      }
      case 'wifi': {
        const ssid = sanitizeInput(inputData.ssid || '');
        const password = sanitizeInput(inputData.password || '');
        const encryption = inputData.encryption || 'WPA';
        formattedData = formatWiFi({ ssid, password, encryption });
        break;
      }
      case 'vcard': {
        const fields = inputData.fields || {};
        const sanitizedFields = {
          firstName: sanitizeInput(fields.firstName || ''),
          lastName: sanitizeInput(fields.lastName || ''),
          phone: sanitizeInput(fields.phone || ''),
          email: sanitizeInput(fields.email || ''),
          organization: sanitizeInput(fields.organization || ''),
          address: sanitizeInput(fields.address || ''),
        };
        formattedData = formatVCard(sanitizedFields);
        break;
      }
      case 'geo':
        formattedData = formatGeo(inputData.latitude, inputData.longitude);
        break;
      default:
        formattedData = rawValue;
    }

    // 7. Check capacity
    const capacityResult = validateCapacity(formattedData, state.errorCorrectionLevel);
    if (!capacityResult.valid) {
      ui.showValidationError(state.dataType, capacityResult.error || 'Data exceeds QR capacity');
      ui.showPlaceholder(true);
      ui.setActionsEnabled(false);
      return;
    }

    // 8-9. Check cache: if formattedData|ecLevel matches, use cached matrix
    const matrixKey = `${formattedData}|${state.errorCorrectionLevel}`;
    let matrix;
    if (matrixKey === cachedMatrixKey && cachedMatrix) {
      matrix = cachedMatrix;
    } else {
      // 10. Encode
      matrix = encode({ data: formattedData, errorCorrectionLevel: state.errorCorrectionLevel });
      // 11. Cache the new matrix
      cachedMatrix = matrix;
      cachedMatrixKey = matrixKey;
    }

    // 12. Render to canvas
    const canvas = document.getElementById('qr-canvas');
    const logoConfig = state.logo ? {
      image: state.logo.image,
      maxAreaPercent: 0.30,
      padding: 8,
    } : null;

    const renderOptions = {
      matrix,
      foregroundColor: state.foregroundColor,
      backgroundColor: state.backgroundColor,
      transparentBackground: state.transparentBackground,
      moduleStyle: state.moduleStyle,
      cornerEyeStyle: state.cornerEyeStyle,
      logo: logoConfig,
      quietZone: state.quietZone,
      size: state.outputSize,
    };

    renderToCanvas(canvas, renderOptions);

    // 13. Run scan validation
    const logoAreaPercent = state.logo ? (state.logo.areaPercent || 0) : 0;
    const scanResult = validateScannability({
      foregroundColor: state.foregroundColor,
      backgroundColor: state.backgroundColor,
      logoAreaPercent,
      quietZoneModules: state.quietZone,
      errorCorrectionLevel: state.errorCorrectionLevel,
    });

    // 14. Update UI: hide placeholder, enable actions, update scan indicator, update aria-label
    ui.showPlaceholder(false);
    ui.setActionsEnabled(true);
    ui.updateScanIndicator(scanResult);
    ui.updateCanvasAriaLabel(state.dataType, formattedData);

    // 15. If logo present and EC < Q: show EC recommendation
    if (state.logo && (state.errorCorrectionLevel === 'L' || state.errorCorrectionLevel === 'M')) {
      ui.showECRecommendation('A logo is embedded — consider using Error Correction level Q or H for better scannability.');
    } else {
      ui.showECRecommendation('');
    }

  } catch (error) {
    // 16. Wrap everything in try/catch — on error, show error banner
    console.error('Render pipeline error:', error);
    ui.showErrorBanner(`Something went wrong: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// 5. Debounced Scheduling
// ---------------------------------------------------------------------------

let renderTimer = null;

/**
 * Schedule a debounced render. Uses 200ms delay for large inputs (>1000 chars),
 * 100ms otherwise.
 */
function scheduleRender() {
  clearTimeout(renderTimer);
  const inputData = ui.getInputData(state.dataType);
  let inputLength = 0;
  switch (state.dataType) {
    case 'url': inputLength = (inputData.url || '').length; break;
    case 'text': inputLength = (inputData.text || '').length; break;
    case 'phone': inputLength = (inputData.number || '').length; break;
    case 'email': inputLength = (inputData.address || '').length; break;
    case 'sms': inputLength = ((inputData.number || '') + (inputData.body || '')).length; break;
    case 'wifi': inputLength = ((inputData.ssid || '') + (inputData.password || '')).length; break;
    case 'vcard': {
      const f = inputData.fields || {};
      inputLength = Object.values(f).join('').length;
      break;
    }
    case 'geo': inputLength = ((inputData.latitude || '') + (inputData.longitude || '')).length; break;
  }
  const delay = inputLength > 1000 ? 200 : 100;
  renderTimer = setTimeout(() => renderPipeline(), delay);
}

// ---------------------------------------------------------------------------
// 6. State Setters
// ---------------------------------------------------------------------------

/**
 * Update a state field and trigger the render pipeline.
 * @param {string} key - State field name
 * @param {*} value - New value
 */
function setState(key, value) {
  state[key] = value;
  state.isDirty = checkDirty();
  scheduleRender();
}

/**
 * Check if any field differs from defaults.
 * @returns {boolean}
 */
function checkDirty() {
  return Object.keys(DEFAULTS).some(key => state[key] !== DEFAULTS[key]) || state.logo !== null;
}

// ---------------------------------------------------------------------------
// 8. Handler Functions
// ---------------------------------------------------------------------------

/**
 * Handle logo file upload. Validates and processes the file,
 * updates state, and triggers re-render.
 * @param {File} file - The uploaded file
 */
async function handleLogoUpload(file) {
  if (!file) return;
  try {
    const result = await processLogo(file);
    state.logo = {
      file,
      image: result.image,
      width: result.width,
      height: result.height,
      areaPercent: 0.25, // approximate; actual placement is calculated by renderer
    };
    ui.showLogoPreview(result.image.src);
    // Show EC recommendation if EC < Q
    if (state.errorCorrectionLevel === 'L' || state.errorCorrectionLevel === 'M') {
      ui.showECRecommendation('A logo is embedded — consider using Error Correction level Q or H for better scannability.');
    }
    state.isDirty = checkDirty();
    scheduleRender();
  } catch (error) {
    ui.showToast(error.message || 'Failed to process logo', 'error');
  }
}

/**
 * Handle QR code download. Renders to offscreen canvas at output size,
 * exports as PNG or SVG, and triggers download.
 */
async function handleDownload() {
  try {
    const format = document.getElementById('export-format').value;
    const canvas = document.getElementById('qr-canvas');

    if (format === 'svg') {
      // Build render options for SVG export
      const logoConfig = state.logo ? {
        image: state.logo.image,
        maxAreaPercent: 0.30,
        padding: 8,
      } : null;

      const svgString = renderToSVGString({
        matrix: cachedMatrix,
        foregroundColor: state.foregroundColor,
        backgroundColor: state.backgroundColor,
        transparentBackground: state.transparentBackground,
        moduleStyle: state.moduleStyle,
        cornerEyeStyle: state.cornerEyeStyle,
        logo: logoConfig,
        quietZone: state.quietZone,
        size: state.outputSize,
      });

      const blob = exportSVG(svgString);
      const filename = generateFilename('svg');
      downloadBlob(blob, filename);
    } else {
      // PNG export: render to offscreen canvas at output size
      const offscreen = document.createElement('canvas');
      offscreen.width = state.outputSize;
      offscreen.height = state.outputSize;

      const logoConfig = state.logo ? {
        image: state.logo.image,
        maxAreaPercent: 0.30,
        padding: 8,
      } : null;

      renderToCanvas(offscreen, {
        matrix: cachedMatrix,
        foregroundColor: state.foregroundColor,
        backgroundColor: state.backgroundColor,
        transparentBackground: state.transparentBackground,
        moduleStyle: state.moduleStyle,
        cornerEyeStyle: state.cornerEyeStyle,
        logo: logoConfig,
        quietZone: state.quietZone,
        size: state.outputSize,
      });

      const blob = await exportPNG(offscreen, {
        size: state.outputSize,
        dpi: 300,
        transparentBackground: state.transparentBackground,
      });
      const filename = generateFilename('png');
      downloadBlob(blob, filename);
    }
  } catch (error) {
    ui.showToast(`Download failed: ${error.message}`, 'error');
  }
}

/**
 * Handle copy to clipboard. Copies the QR canvas as a PNG image.
 */
async function handleCopy() {
  try {
    const canvas = document.getElementById('qr-canvas');
    await copyToClipboard(canvas);
    ui.showToast('QR code copied to clipboard', 'success');
  } catch (error) {
    ui.showToast(error.message || 'Failed to copy to clipboard. Try downloading instead.', 'error');
  }
}

/**
 * Handle share via native OS share menu.
 */
async function handleShare() {
  try {
    const canvas = document.getElementById('qr-canvas');
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('Failed to create image blob'));
      }, 'image/png');
    });
    const filename = generateFilename('png');
    await shareQRCode(blob, filename);
  } catch (error) {
    // AbortError means user cancelled the share — not an error
    if (error.name !== 'AbortError') {
      ui.showToast(error.message || 'Failed to share QR code', 'error');
    }
  }
}

/**
 * Handle reset. Confirms with user, then restores all defaults.
 */
function handleReset() {
  if (!confirm('Reset all settings and clear input? This cannot be undone.')) {
    return;
  }

  // Restore defaults
  Object.assign(state, DEFAULTS);
  state.inputData = { type: 'url', url: '' };
  state.logo = null;
  state.isDirty = false;

  // Clear all input fields
  clearAllInputs();

  // Hide logo preview
  ui.hideLogoPreview();
  ui.showECRecommendation('');

  // Clear cached matrix
  cachedMatrix = null;
  cachedMatrixKey = '';

  // Show the URL input form (default type)
  ui.showInputForm('url');

  // Re-render
  scheduleRender();
}

/**
 * Clear all input fields across all data types.
 */
function clearAllInputs() {
  // URL
  const urlField = document.getElementById('input-url-field');
  if (urlField) urlField.value = '';

  // Text
  const textField = document.getElementById('input-text-field');
  if (textField) textField.value = '';

  // Phone
  const phoneField = document.getElementById('input-phone-field');
  if (phoneField) phoneField.value = '';

  // Email
  const emailField = document.getElementById('input-email-field');
  if (emailField) emailField.value = '';

  // SMS
  const smsPhone = document.getElementById('input-sms-phone');
  if (smsPhone) smsPhone.value = '';
  const smsBody = document.getElementById('input-sms-body');
  if (smsBody) smsBody.value = '';

  // Wi-Fi
  const wifiSsid = document.getElementById('input-wifi-ssid');
  if (wifiSsid) wifiSsid.value = '';
  const wifiPassword = document.getElementById('input-wifi-password');
  if (wifiPassword) wifiPassword.value = '';
  const wifiEncryption = document.getElementById('input-wifi-encryption');
  if (wifiEncryption) wifiEncryption.value = 'WPA';

  // vCard
  const vcardFields = ['input-vcard-firstname', 'input-vcard-lastname', 'input-vcard-phone', 'input-vcard-email', 'input-vcard-org', 'input-vcard-address'];
  for (const id of vcardFields) {
    const el = document.getElementById(id);
    if (el) el.value = '';
  }

  // Geo
  const geoLat = document.getElementById('input-geo-lat');
  if (geoLat) geoLat.value = '';
  const geoLng = document.getElementById('input-geo-lng');
  if (geoLng) geoLng.value = '';

  // Reset color pickers
  const fgColor = document.getElementById('color-foreground');
  if (fgColor) fgColor.value = '#000000';
  const bgColor = document.getElementById('color-background');
  if (bgColor) bgColor.value = '#FFFFFF';

  // Reset transparent background
  const transparentBg = document.getElementById('transparent-bg');
  if (transparentBg) transparentBg.checked = false;

  // Reset module style dropdown
  const moduleStyleSelect = document.getElementById('module-style-select');
  if (moduleStyleSelect) moduleStyleSelect.value = 'square';

  // Reset corner eye style dropdown
  const cornerEyeSelect = document.getElementById('corner-eye-style-select');
  if (cornerEyeSelect) cornerEyeSelect.value = 'square';

  // Reset EC level radios
  const ecM = document.querySelector('input[name="ecLevel"][value="M"]');
  if (ecM) ecM.checked = true;

  // Reset size selector
  const sizeSelector = document.getElementById('size-selector');
  if (sizeSelector) sizeSelector.value = '512';

  // Reset quiet zone
  const quietZoneRange = document.getElementById('quiet-zone-range');
  if (quietZoneRange) quietZoneRange.value = '4';
  ui.updateQuietZoneOutput(4);

  // Reset data type dropdown to URL
  const dataTypeDropdown = document.getElementById('data-type-dropdown');
  if (dataTypeDropdown) dataTypeDropdown.value = 'url';

  // Reset data type description
  const descEl = document.getElementById('data-type-description');
  if (descEl) descEl.textContent = "Opens a link in the scanner's browser.";

  // Clear all validation errors
  for (const type of ['url', 'text', 'phone', 'email', 'sms', 'wifi', 'vcard', 'geo', 'logo']) {
    ui.clearValidationError(type);
  }
}

// ---------------------------------------------------------------------------
// 7 & 9. Event Wiring and Initialization
// ---------------------------------------------------------------------------

/**
 * Load example content for the given data type into the input fields.
 * @param {string} dataType - The data type to load example content for
 */
function loadExampleContent(dataType) {
  const example = EXAMPLE_CONTENT[dataType];
  if (!example) return;

  switch (dataType) {
    case 'url': {
      const field = document.getElementById('input-url-field');
      if (field) field.value = example;
      break;
    }
    case 'text': {
      const field = document.getElementById('input-text-field');
      if (field) field.value = example;
      break;
    }
    case 'phone': {
      const field = document.getElementById('input-phone-field');
      if (field) field.value = example;
      break;
    }
    case 'email': {
      const field = document.getElementById('input-email-field');
      if (field) field.value = example;
      break;
    }
    case 'sms': {
      const phoneField = document.getElementById('input-sms-phone');
      const bodyField = document.getElementById('input-sms-body');
      if (phoneField) phoneField.value = example.number;
      if (bodyField) bodyField.value = example.body;
      break;
    }
    case 'wifi': {
      const ssidField = document.getElementById('input-wifi-ssid');
      const passwordField = document.getElementById('input-wifi-password');
      const encryptionField = document.getElementById('input-wifi-encryption');
      if (ssidField) ssidField.value = example.ssid;
      if (passwordField) passwordField.value = example.password;
      if (encryptionField) encryptionField.value = example.encryption;
      break;
    }
    case 'vcard': {
      const fields = {
        'input-vcard-firstname': example.firstName,
        'input-vcard-lastname': example.lastName,
        'input-vcard-phone': example.phone,
        'input-vcard-email': example.email,
        'input-vcard-org': example.organization,
        'input-vcard-address': example.address,
      };
      for (const [id, value] of Object.entries(fields)) {
        const el = document.getElementById(id);
        if (el) el.value = value;
      }
      break;
    }
    case 'geo': {
      const latField = document.getElementById('input-geo-lat');
      const lngField = document.getElementById('input-geo-lng');
      if (latField) latField.value = example.latitude;
      if (lngField) lngField.value = example.longitude;
      break;
    }
  }
}

/**
 * Initialize the application: set up share button, wire all events,
 * set up global error handlers, load example content, and render.
 */
function init() {
  // Set up share button visibility
  ui.setupShareButton();

  // --- Data type descriptions ---
  const DATA_TYPE_DESCRIPTIONS = {
    url: "Opens a link in the scanner's browser.",
    text: 'Displays text as-is when scanned. Up to 2,953 characters.',
    phone: "Prompts the scanner's phone to call this number.",
    email: "Opens the scanner's email app with this address pre-filled.",
    sms: "Opens the scanner's messaging app with a number and optional message.",
    wifi: "Automatically connects the scanner's device to a Wi-Fi network.",
    vcard: "Saves a contact card directly to the scanner's address book.",
    geo: 'Opens a map application at the specified coordinates.',
  };

  function updateDataTypeDescription(dataType) {
    const descEl = document.getElementById('data-type-description');
    if (descEl) {
      descEl.textContent = DATA_TYPE_DESCRIPTIONS[dataType] || '';
    }
  }

  // --- Data type dropdown ---
  const dataTypeDropdown = document.getElementById('data-type-dropdown');
  if (dataTypeDropdown) {
    dataTypeDropdown.addEventListener('change', (e) => {
      state.dataType = e.target.value;
      updateDataTypeDescription(state.dataType);
      ui.showInputForm(state.dataType);
      state.isDirty = checkDirty();
      scheduleRender();
    });
  }

  // --- All input fields in the input area ---
  const inputSection = document.querySelector('.section-input');
  if (inputSection) {
    inputSection.addEventListener('input', () => {
      scheduleRender();
    });
    inputSection.addEventListener('change', () => {
      scheduleRender();
    });
  }

  // --- Color pickers ---
  const fgColor = document.getElementById('color-foreground');
  if (fgColor) {
    fgColor.addEventListener('input', (e) => {
      setState('foregroundColor', e.target.value);
    });
  }

  const bgColor = document.getElementById('color-background');
  if (bgColor) {
    bgColor.addEventListener('input', (e) => {
      setState('backgroundColor', e.target.value);
    });
  }

  // --- Transparent background checkbox ---
  const transparentBg = document.getElementById('transparent-bg');
  if (transparentBg) {
    transparentBg.addEventListener('change', (e) => {
      setState('transparentBackground', e.target.checked);
    });
  }

  // --- Module style dropdown ---
  const moduleStyleSelect = document.getElementById('module-style-select');
  if (moduleStyleSelect) {
    moduleStyleSelect.addEventListener('change', (e) => {
      setState('moduleStyle', e.target.value);
    });
  }

  // --- Corner eye style dropdown ---
  const cornerEyeSelect = document.getElementById('corner-eye-style-select');
  if (cornerEyeSelect) {
    cornerEyeSelect.addEventListener('change', (e) => {
      setState('cornerEyeStyle', e.target.value);
    });
  }

  // --- EC level radios ---
  const ecLevelRadios = document.querySelectorAll('input[name="ecLevel"]');
  for (const radio of ecLevelRadios) {
    radio.addEventListener('change', (e) => {
      setState('errorCorrectionLevel', e.target.value);
    });
  }

  // --- Size selector ---
  const sizeSelector = document.getElementById('size-selector');
  if (sizeSelector) {
    sizeSelector.addEventListener('change', (e) => {
      setState('outputSize', parseInt(e.target.value, 10));
    });
  }

  // --- Quiet zone range ---
  const quietZoneRange = document.getElementById('quiet-zone-range');
  if (quietZoneRange) {
    quietZoneRange.addEventListener('input', (e) => {
      const value = parseInt(e.target.value, 10);
      ui.updateQuietZoneOutput(value);
      setState('quietZone', value);
    });
  }

  // --- Logo file input ---
  const logoFileInput = document.getElementById('logo-file-input');
  if (logoFileInput) {
    logoFileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) handleLogoUpload(file);
    });
  }

  // --- Logo drop zone ---
  const logoDropZone = document.getElementById('logo-drop-zone');
  if (logoDropZone) {
    logoDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      logoDropZone.classList.add('drop-zone-active');
    });

    logoDropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      logoDropZone.classList.remove('drop-zone-active');
    });

    logoDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      logoDropZone.classList.remove('drop-zone-active');
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) handleLogoUpload(file);
    });
  }

  // --- Logo remove button ---
  const logoRemoveBtn = document.getElementById('logo-remove-btn');
  if (logoRemoveBtn) {
    logoRemoveBtn.addEventListener('click', () => {
      state.logo = null;
      ui.hideLogoPreview();
      ui.showECRecommendation('');
      state.isDirty = checkDirty();
      scheduleRender();
    });
  }

  // --- Download button ---
  const downloadBtn = document.getElementById('btn-download');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => handleDownload());
  }

  // --- Copy button ---
  const copyBtn = document.getElementById('btn-copy');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => handleCopy());
  }

  // --- Share button ---
  const shareBtn = document.getElementById('btn-share');
  if (shareBtn) {
    shareBtn.addEventListener('click', () => handleShare());
  }

  // --- Reset button ---
  const resetBtn = document.getElementById('btn-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => handleReset());
  }

  // --- Shortcuts button ---
  const shortcutsBtn = document.getElementById('shortcuts-btn');
  if (shortcutsBtn) {
    shortcutsBtn.addEventListener('click', () => ui.openShortcutsDialog());
  }

  // --- Shortcuts close button ---
  const shortcutsCloseBtn = document.getElementById('shortcuts-close-btn');
  if (shortcutsCloseBtn) {
    shortcutsCloseBtn.addEventListener('click', () => ui.closeShortcutsDialog());
  }

  // --- Help dialog ---
  const HELP_CONTENT = {
    datatype: {
      title: 'Data Types',
      body: `
        <p>Each QR code encodes one type of content. Pick the type that matches what you want the scanner's device to do.</p>
        <ul>
          <li><strong>URL</strong> — Opens a web link in the browser.</li>
          <li><strong>Plain Text</strong> — Displays text as-is. Up to 2,953 characters.</li>
          <li><strong>Phone</strong> — Prompts the device to call the number.</li>
          <li><strong>Email</strong> — Opens the email app with the address pre-filled.</li>
          <li><strong>SMS</strong> — Opens the messaging app with a number and optional message.</li>
          <li><strong>Wi-Fi</strong> — Automatically connects the device to a Wi-Fi network.</li>
          <li><strong>vCard</strong> — Saves a contact card to the phone's address book.</li>
          <li><strong>Geo</strong> — Opens a map at the specified coordinates.</li>
        </ul>
        <p>Data types are mutually exclusive — each QR code does one thing.</p>
      `,
    },
    content: {
      title: 'Content Fields',
      body: `
        <p>Enter the information you want to encode. The fields shown depend on the data type you selected.</p>
        <p>Each type has its own validation rules:</p>
        <ul>
          <li><strong>URL</strong> must start with <strong>http://</strong> or <strong>https://</strong>.</li>
          <li><strong>Phone</strong> accepts digits, spaces, hyphens, parentheses, and an optional leading +.</li>
          <li><strong>Email</strong> must be a valid email address format.</li>
          <li><strong>SMS</strong> requires a phone number; the message body is optional.</li>
          <li><strong>Wi-Fi</strong> requires a network name (SSID). Password can be left blank for open networks.</li>
          <li><strong>vCard</strong> requires at least a first or last name. All other fields are optional.</li>
          <li><strong>Geo</strong> requires latitude (-90 to 90) and longitude (-180 to 180).</li>
        </ul>
        <p>The QR code updates live as you type.</p>
      `,
    },
    customization: {
      title: 'Customization Options',
      body: `
        <p><strong>Colors:</strong> Set the foreground (dark modules) and background colors. Keep good contrast for reliable scanning. Check "Transparent background" if you plan to overlay the QR code on another design.</p>
        <p><strong>Shape:</strong> Module Style controls the shape of the individual squares — standard or rounded. Corner Eye Style changes the three large finder patterns in the corners.</p>
        <p><strong>Logo:</strong> Upload an image (PNG, JPEG, or SVG, max 2 MB) to place in the center. The logo is scaled to cover no more than 30% of the code. Adding a logo covers data, so consider using Error Correction Q or H.</p>
        <p><strong>Error Correction:</strong> QR codes have built-in redundancy so they can be read even if partially damaged or covered by a logo.</p>
        <ul>
          <li><strong>L</strong> — 7% recovery. Maximum data capacity.</li>
          <li><strong>M</strong> — 15% recovery. Good default for most uses.</li>
          <li><strong>Q</strong> — 25% recovery. Recommended when using a logo.</li>
          <li><strong>H</strong> — 30% recovery. Maximum damage tolerance.</li>
        </ul>
        <p><strong>Output Size:</strong> The pixel dimensions of the exported image. This only affects the download — the preview adapts to fit the screen.</p>
        <p><strong>Quiet Zone:</strong> The blank margin around the QR code. Scanners need this space to detect where the code begins. The standard recommendation is 4 modules.</p>
      `,
    },
    preview: {
      title: 'Preview & Scan Indicator',
      body: `
        <p>The preview updates live as you type or change settings.</p>
        <p>The scan indicator below the preview tells you whether your QR code is likely to scan correctly:</p>
        <ul>
          <li>🟢 <strong>Scannable</strong> — Everything looks good.</li>
          <li>🟡 <strong>At Risk</strong> — The code will probably scan, but some settings may cause issues (low contrast, small quiet zone, or a large logo with low error correction).</li>
          <li>🔴 <strong>Unscannable</strong> — The code is unlikely to scan reliably.</li>
        </ul>
        <p>Warning messages explain exactly what the issue is and how to fix it.</p>
      `,
    },
    export: {
      title: 'Export Options',
      body: `
        <p><strong>Download:</strong> Save the QR code as a PNG (standard image, 300 DPI) or SVG (scalable vector, ideal for print or design tools). The file is named with a timestamp automatically.</p>
        <p><strong>Copy to Clipboard:</strong> Copies the QR code as a PNG image you can paste into emails, documents, or design tools. Requires HTTPS.</p>
        <p><strong>Share:</strong> On supported devices, opens the native share menu (AirDrop, Messages, etc.). This button only appears when your browser supports it.</p>
        <p><strong>Reset:</strong> Clears everything and restores all settings to defaults. You'll be asked to confirm first.</p>
      `,
    },
    colors: {
      title: 'Colors',
      body: `
        <p><strong>Foreground</strong> is the color of the dark modules (the squares that make up the QR pattern). Default is black.</p>
        <p><strong>Background</strong> is the color behind the modules. Default is white.</p>
        <p><strong>Transparent background</strong> makes the background see-through in the exported image. Useful when placing the QR code on top of a colored surface in a design tool.</p>
        <p>Click the color swatch to open your system's color picker. Keep good contrast between foreground and background — the scan indicator will warn you if contrast is too low.</p>
      `,
    },
    shape: {
      title: 'Shape',
      body: `
        <p><strong>Module Style</strong> controls the shape of the individual squares in the QR code:</p>
        <ul>
          <li><strong>Square</strong> — standard sharp-cornered modules (default)</li>
          <li><strong>Rounded</strong> — modules with softly rounded corners for a more modern look</li>
        </ul>
        <p><strong>Corner Eye Style</strong> changes the three large squares in the corners (called "finder patterns" or "eyes"):</p>
        <ul>
          <li><strong>Square</strong> — standard sharp corners (default)</li>
          <li><strong>Rounded</strong> — rounded corners on the eye patterns</li>
          <li><strong>Dot</strong> — the center of each eye is drawn as a circle</li>
        </ul>
      `,
    },
    logo: {
      title: 'Logo',
      body: `
        <p>Upload an image to place in the center of your QR code. Commonly used for branding — a company logo, app icon, or profile picture.</p>
        <ul>
          <li><strong>Accepted formats:</strong> PNG, JPEG, or SVG</li>
          <li><strong>Maximum file size:</strong> 2 MB</li>
          <li><strong>Maximum dimensions:</strong> 2048 × 2048 pixels</li>
        </ul>
        <p>The logo is automatically scaled to cover no more than 30% of the QR code area, with padding added around it.</p>
        <p><strong>Important:</strong> Adding a logo covers part of the QR code data. The app will recommend switching to Error Correction Q or H to compensate. If you ignore this, the QR code may not scan reliably.</p>
      `,
    },
    errorcorrection: {
      title: 'Error Correction',
      body: `
        <p>QR codes have built-in redundancy that allows them to be read even if part of the code is damaged or obscured (like by a logo).</p>
        <ul>
          <li><strong>L</strong> — 7% recovery. Maximum data capacity, minimal damage tolerance.</li>
          <li><strong>M</strong> — 15% recovery. Good balance for most uses (default).</li>
          <li><strong>Q</strong> — 25% recovery. Recommended when using a logo.</li>
          <li><strong>H</strong> — 30% recovery. Maximum damage tolerance, smallest data capacity.</li>
        </ul>
        <p>Higher error correction means the QR code can survive more damage, but it also makes the code denser (more modules), which can make it harder to scan at small sizes.</p>
      `,
    },
    outputsize: {
      title: 'Output Size',
      body: `
        <p>Choose the pixel dimensions of the exported image:</p>
        <ul>
          <li><strong>256 × 256</strong> — small, suitable for digital use</li>
          <li><strong>512 × 512</strong> — good general-purpose size (default)</li>
          <li><strong>1024 × 1024</strong> — high quality for print</li>
          <li><strong>2048 × 2048</strong> — maximum quality for large-format printing</li>
        </ul>
        <p>This only affects the downloaded file — the on-screen preview adapts to fit the available space.</p>
      `,
    },
    quietzone: {
      title: 'Quiet Zone',
      body: `
        <p>The "quiet zone" is the blank margin around the QR code. Scanners need this empty space to detect where the code begins and ends.</p>
        <ul>
          <li><strong>Default: 4 modules</strong> — the standard recommended by the QR code specification</li>
          <li><strong>Range: 0 to 8 modules</strong></li>
        </ul>
        <p>The scan indicator will warn you if you reduce the quiet zone below 4 modules, and will flag the code as unscannable if you set it to 0.</p>
      `,
    },
  };

  const helpDialog = document.getElementById('help-dialog');
  const helpDialogTitle = document.getElementById('help-dialog-title');
  const helpDialogBody = document.getElementById('help-dialog-body');
  const helpCloseBtn = document.getElementById('help-close-btn');

  document.addEventListener('click', (e) => {
    const helpBtn = e.target.closest('.btn-help');
    if (!helpBtn) return;
    const key = helpBtn.getAttribute('data-help');
    const content = HELP_CONTENT[key];
    if (!content || !helpDialog) return;
    helpDialogTitle.textContent = content.title;
    helpDialogBody.innerHTML = DOMPurify.sanitize(content.body);
    helpDialog.showModal();
  });

  if (helpCloseBtn) {
    helpCloseBtn.addEventListener('click', () => {
      if (helpDialog) helpDialog.close();
    });
  }

  // --- Error banner reset button ---
  const errorBannerReset = document.getElementById('error-banner-reset');
  if (errorBannerReset) {
    errorBannerReset.addEventListener('click', () => {
      window.location.reload();
    });
  }

  // --- Keyboard shortcuts ---
  document.addEventListener('keydown', (e) => {
    // Don't trigger shortcuts when typing in input fields (except for Ctrl/Cmd combos)
    const isInputFocused = e.target.matches('input, textarea, select');

    // Ctrl/Cmd + D → Download
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'd') {
      e.preventDefault();
      const dlBtn = document.getElementById('btn-download');
      if (dlBtn && !dlBtn.disabled) handleDownload();
      return;
    }

    // Ctrl/Cmd + Shift + C → Copy to clipboard
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      const cpBtn = document.getElementById('btn-copy');
      if (cpBtn && !cpBtn.disabled) handleCopy();
      return;
    }

    // ? → Show keyboard shortcuts (only when not typing in an input)
    if (e.key === '?' && !isInputFocused) {
      e.preventDefault();
      ui.openShortcutsDialog();
      return;
    }
  });

  // --- Unsaved work protection ---
  window.addEventListener('beforeunload', (e) => {
    if (state.isDirty) {
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      return e.returnValue;
    }
  });

  // --- Global error handlers ---
  window.onerror = (message, source, lineno, colno, error) => {
    console.error('Global error:', message, source, lineno, colno, error);
    ui.showErrorBanner('An unexpected error occurred. You can try resetting the application.');
  };

  window.onunhandledrejection = (event) => {
    console.error('Unhandled rejection:', event.reason);
    ui.showErrorBanner('An unexpected error occurred. You can try resetting the application.');
  };

  // --- Load example content for default type ---
  loadExampleContent(state.dataType);

  // --- Initial render ---
  renderPipeline();

  // --- Hide placeholder after initial render (if QR was generated) ---
  // The renderPipeline already handles showing/hiding placeholder based on validation
}

// ---------------------------------------------------------------------------
// DOM Ready
// ---------------------------------------------------------------------------

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
