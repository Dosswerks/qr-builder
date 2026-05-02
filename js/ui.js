/**
 * UI controller module for QR Builder.
 * Handles all DOM manipulation, form handling, tooltips, error display,
 * and accessibility features. Does NOT manage state or the render pipeline —
 * that's app.js's job. This module provides functions that app.js calls.
 * @module ui
 */

/**
 * All supported data types and their corresponding input group IDs.
 * @type {string[]}
 */
const DATA_TYPES = ['url', 'text', 'phone', 'email', 'sms', 'wifi', 'vcard', 'geo'];

/**
 * Read current form values for the given data type from the DOM.
 * Returns the appropriate input data object based on the data type.
 * @param {string} dataType - One of: 'url', 'text', 'phone', 'email', 'sms', 'wifi', 'vcard', 'geo'
 * @returns {Object} Input data object with a `type` field matching the data type
 */
export function getInputData(dataType) {
  switch (dataType) {
    case 'url':
      return {
        type: 'url',
        url: document.getElementById('input-url-field').value,
      };
    case 'text':
      return {
        type: 'text',
        text: document.getElementById('input-text-field').value,
      };
    case 'phone':
      return {
        type: 'phone',
        number: document.getElementById('input-phone-field').value,
      };
    case 'email':
      return {
        type: 'email',
        address: document.getElementById('input-email-field').value,
      };
    case 'sms':
      return {
        type: 'sms',
        number: document.getElementById('input-sms-phone').value,
        body: document.getElementById('input-sms-body').value,
      };
    case 'wifi':
      return {
        type: 'wifi',
        ssid: document.getElementById('input-wifi-ssid').value,
        password: document.getElementById('input-wifi-password').value,
        encryption: document.getElementById('input-wifi-encryption').value,
      };
    case 'vcard':
      return {
        type: 'vcard',
        fields: {
          firstName: document.getElementById('input-vcard-firstname').value,
          lastName: document.getElementById('input-vcard-lastname').value,
          phone: document.getElementById('input-vcard-phone').value,
          email: document.getElementById('input-vcard-email').value,
          organization: document.getElementById('input-vcard-org').value,
          address: document.getElementById('input-vcard-address').value,
        },
      };
    case 'geo':
      return {
        type: 'geo',
        latitude: document.getElementById('input-geo-lat').value,
        longitude: document.getElementById('input-geo-lng').value,
      };
    default:
      return { type: dataType };
  }
}

/**
 * Show the input form for the given data type, hide all others.
 * Sets `hidden` attribute on non-active forms and moves focus
 * to the first input of the new form.
 * @param {string} dataType - The data type to show (e.g., 'url', 'wifi', 'vcard')
 */
export function showInputForm(dataType) {
  for (const type of DATA_TYPES) {
    const group = document.getElementById(`input-${type}`);
    if (!group) continue;

    if (type === dataType) {
      group.removeAttribute('hidden');
    } else {
      group.setAttribute('hidden', '');
    }
  }

  // Move focus to the first input of the newly shown form
  const activeGroup = document.getElementById(`input-${dataType}`);
  if (activeGroup) {
    const firstInput = activeGroup.querySelector('input, textarea, select');
    if (firstInput) {
      firstInput.focus();
    }
  }
}

/**
 * Display a validation error message for the given data type.
 * Sets the text content of the error element (e.g., `error-url`, `error-phone`).
 * @param {string} dataType - The data type whose error element to update
 * @param {string} message - The error message to display
 */
export function showValidationError(dataType, message) {
  const errorEl = document.getElementById(`error-${dataType}`);
  if (errorEl) {
    errorEl.textContent = message;
  }
}

/**
 * Clear the validation error message for the given data type.
 * @param {string} dataType - The data type whose error element to clear
 */
export function clearValidationError(dataType) {
  const errorEl = document.getElementById(`error-${dataType}`);
  if (errorEl) {
    errorEl.textContent = '';
  }
}

/**
 * Update the scan indicator display.
 * @param {Object} result - Scan validation result
 * @param {string} result.status - 'ok', 'at-risk', or 'unscannable'
 * @param {string[]} result.warnings - Array of warning messages
 */
export function updateScanIndicator(result) {
  const indicator = document.getElementById('scan-indicator');
  const statusText = document.getElementById('scan-status-text');
  const warningsList = document.getElementById('scan-warnings');

  if (indicator) {
    indicator.setAttribute('data-status', result.status);
  }

  if (statusText) {
    const labels = {
      'ok': 'Scannable',
      'at-risk': 'At Risk',
      'unscannable': 'Unscannable',
    };
    statusText.textContent = labels[result.status] || result.status;
  }

  if (warningsList) {
    warningsList.innerHTML = '';
    for (const warning of result.warnings) {
      const li = document.createElement('li');
      li.textContent = warning;
      warningsList.appendChild(li);
    }
  }
}

/**
 * Enable or disable the download, copy, and share action buttons.
 * Sets or removes the `disabled` attribute.
 * @param {boolean} enabled - Whether the buttons should be enabled
 */
export function setActionsEnabled(enabled) {
  const buttons = [
    document.getElementById('btn-download'),
    document.getElementById('btn-copy'),
    document.getElementById('btn-share'),
  ];

  for (const btn of buttons) {
    if (!btn) continue;
    if (enabled) {
      btn.removeAttribute('disabled');
    } else {
      btn.setAttribute('disabled', '');
    }
  }
}

/**
 * Show or hide the preview placeholder text.
 * Toggles `hidden` on `#preview-placeholder` and toggles canvas visibility.
 * @param {boolean} show - Whether to show the placeholder (true) or the canvas (false)
 */
export function showPlaceholder(show) {
  const placeholder = document.getElementById('preview-placeholder');
  const canvas = document.getElementById('qr-canvas');

  if (placeholder) {
    if (show) {
      placeholder.removeAttribute('hidden');
    } else {
      placeholder.setAttribute('hidden', '');
    }
  }

  if (canvas) {
    if (show) {
      canvas.setAttribute('hidden', '');
    } else {
      canvas.removeAttribute('hidden');
    }
  }
}

/**
 * Update the `aria-label` on the QR canvas with a description of the encoded content.
 * Truncates data to 50 characters.
 * @param {string} dataType - The current data type (e.g., 'url', 'phone')
 * @param {string} data - The encoded data string to describe
 */
export function updateCanvasAriaLabel(dataType, data) {
  const canvas = document.getElementById('qr-canvas');
  if (!canvas) return;

  const typeLabels = {
    'url': 'URL',
    'text': 'Plain Text',
    'phone': 'Phone',
    'email': 'Email',
    'sms': 'SMS',
    'wifi': 'Wi-Fi',
    'vcard': 'vCard',
    'geo': 'Geo',
  };

  const label = typeLabels[dataType] || dataType;
  const truncated = data.length > 50 ? data.substring(0, 50) + '...' : data;
  canvas.setAttribute('aria-label', `QR code encoding ${label}: ${truncated}`);
}

/**
 * Show or hide the EC recommendation message.
 * Sets text on `#ec-recommendation` and toggles `hidden`.
 * @param {string} message - The recommendation message, or empty string to hide
 */
export function showECRecommendation(message) {
  const el = document.getElementById('ec-recommendation');
  if (!el) return;

  if (message) {
    el.textContent = message;
    el.removeAttribute('hidden');
  } else {
    el.textContent = '';
    el.setAttribute('hidden', '');
  }
}

/**
 * Create and display a toast notification.
 * Auto-removes after 4 seconds.
 * @param {string} message - The notification message
 * @param {string} type - 'success', 'error', or 'warning'
 */
export function showToast(message, type) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'status');
  toast.textContent = message;

  container.appendChild(toast);

  // Auto-remove after 4 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 4000);
}

/**
 * Show the global error banner with the given message.
 * Sets text on `#error-banner-message` and removes `hidden` from `#error-banner`.
 * @param {string} message - The error message to display
 */
export function showErrorBanner(message) {
  const banner = document.getElementById('error-banner');
  const messageEl = document.getElementById('error-banner-message');

  if (messageEl) {
    messageEl.textContent = message;
  }

  if (banner) {
    banner.removeAttribute('hidden');
  }
}

/**
 * Hide the global error banner.
 */
export function hideErrorBanner() {
  const banner = document.getElementById('error-banner');
  if (banner) {
    banner.setAttribute('hidden', '');
  }
}

/**
 * Update the `#quiet-zone-value` output element text.
 * @param {number|string} value - The quiet zone value to display
 */
export function updateQuietZoneOutput(value) {
  const output = document.getElementById('quiet-zone-value');
  if (output) {
    output.textContent = value;
  }
}

/**
 * Show the logo preview area with the uploaded image.
 * Sets `#logo-preview-img` src, shows `#logo-preview`, hides `#logo-drop-zone`.
 * @param {string} imageSrc - The image source URL (data URL or object URL)
 */
export function showLogoPreview(imageSrc) {
  const previewImg = document.getElementById('logo-preview-img');
  const preview = document.getElementById('logo-preview');
  const dropZone = document.getElementById('logo-drop-zone');

  if (previewImg) {
    previewImg.src = imageSrc;
    previewImg.style.display = '';
  }

  if (preview) {
    preview.removeAttribute('hidden');
  }

  if (dropZone) {
    dropZone.setAttribute('hidden', '');
  }
}

/**
 * Hide the logo preview and show the drop zone again.
 * Clears the file input value.
 */
export function hideLogoPreview() {
  const preview = document.getElementById('logo-preview');
  const dropZone = document.getElementById('logo-drop-zone');
  const fileInput = document.getElementById('logo-file-input');
  const previewImg = document.getElementById('logo-preview-img');

  if (preview) {
    preview.setAttribute('hidden', '');
  }

  if (dropZone) {
    dropZone.removeAttribute('hidden');
  }

  if (fileInput) {
    fileInput.value = '';
  }

  if (previewImg) {
    previewImg.removeAttribute('src');
    previewImg.style.display = 'none';
  }
}

/**
 * Check if `navigator.share` is available.
 * If yes, show `#btn-share` (remove `hidden`). If no, keep it hidden.
 */
export function setupShareButton() {
  const shareBtn = document.getElementById('btn-share');
  if (!shareBtn) return;

  if (navigator.share) {
    shareBtn.removeAttribute('hidden');
  } else {
    shareBtn.setAttribute('hidden', '');
  }
}

/**
 * Open the keyboard shortcuts dialog using the native `<dialog>` API.
 */
export function openShortcutsDialog() {
  const dialog = document.getElementById('shortcuts-dialog');
  if (dialog && typeof dialog.showModal === 'function') {
    dialog.showModal();
  }
}

/**
 * Close the keyboard shortcuts dialog.
 */
export function closeShortcutsDialog() {
  const dialog = document.getElementById('shortcuts-dialog');
  if (dialog && typeof dialog.close === 'function') {
    dialog.close();
  }
}
