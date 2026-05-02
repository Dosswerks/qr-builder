/**
 * Security and input sanitization layer.
 * Provides XSS prevention, malicious URL detection, SVG sanitization,
 * and file validation utilities.
 * @module security
 */

/**
 * Sanitize user input via DOMPurify (loaded from CDN as a global).
 * Prevents XSS by stripping dangerous HTML/JS from input strings.
 * @param {string} input - Raw user input
 * @returns {string} Sanitized string
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return '';
  }
  return window.DOMPurify.sanitize(input);
}

/**
 * Detect potentially malicious URLs.
 * Checks for javascript: scheme, data: scheme with executable content,
 * and known phishing patterns.
 * @param {string} url - URL string to check
 * @returns {{ isMalicious: boolean, reason?: string }}
 */
export function detectMaliciousURL(url) {
  if (typeof url !== 'string') {
    return { isMalicious: false };
  }

  const trimmed = url.trim().toLowerCase();

  // Check for javascript: scheme
  if (trimmed.startsWith('javascript:')) {
    return { isMalicious: true, reason: 'URL uses the javascript: scheme, which can execute arbitrary code' };
  }

  // Check for data: scheme with executable content types
  if (trimmed.startsWith('data:')) {
    const executableTypes = [
      'text/html',
      'application/javascript',
      'application/x-javascript',
      'text/javascript',
      'application/ecmascript',
      'text/ecmascript',
    ];
    const hasExecutableContent = executableTypes.some((type) => trimmed.startsWith(`data:${type}`));
    if (hasExecutableContent) {
      return { isMalicious: true, reason: 'URL uses the data: scheme with executable content' };
    }
  }

  // Check for known phishing patterns
  const phishingPatterns = [
    /\@.*\@/,                          // Multiple @ signs (credential confusion)
    /https?:\/\/[^/]*@/,               // Credentials in URL (user@host trick)
    /%[0-9a-f]{2}.*%[0-9a-f]{2}/i,    // Excessive URL encoding (obfuscation)
  ];

  for (const pattern of phishingPatterns) {
    if (pattern.test(trimmed)) {
      return { isMalicious: true, reason: 'URL matches a known phishing pattern' };
    }
  }

  return { isMalicious: false };
}

/**
 * Sanitize SVG content by stripping dangerous elements and attributes.
 * Removes <script> elements, event handler attributes (on*),
 * javascript: URIs, and <foreignObject> elements.
 * @param {string} svgContent - Raw SVG markup string
 * @returns {string} Cleaned SVG string
 */
export function sanitizeSVG(svgContent) {
  if (typeof svgContent !== 'string') {
    return '';
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, 'image/svg+xml');

  // Check for parse errors
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    return '';
  }

  /**
   * Recursively clean a DOM node by removing dangerous elements and attributes.
   * @param {Element} element
   */
  function cleanNode(element) {
    // Collect children to remove (can't modify while iterating)
    const toRemove = [];

    for (const child of element.children) {
      const tagName = child.tagName.toLowerCase();

      // Remove <script> elements
      if (tagName === 'script') {
        toRemove.push(child);
        continue;
      }

      // Remove <foreignObject> elements
      if (tagName === 'foreignobject') {
        toRemove.push(child);
        continue;
      }

      // Remove event handler attributes (on*)
      const attrs = Array.from(child.attributes);
      for (const attr of attrs) {
        const attrName = attr.name.toLowerCase();

        // Remove on* event handlers
        if (attrName.startsWith('on')) {
          child.removeAttribute(attr.name);
        }

        // Remove javascript: URIs in href, xlink:href, src, etc.
        if (['href', 'xlink:href', 'src', 'action', 'formaction'].includes(attrName)) {
          if (attr.value.trim().toLowerCase().startsWith('javascript:')) {
            child.removeAttribute(attr.name);
          }
        }
      }

      // Recurse into children
      cleanNode(child);
    }

    for (const node of toRemove) {
      element.removeChild(node);
    }
  }

  cleanNode(doc.documentElement);

  // Also clean attributes on the root <svg> element itself
  const rootAttrs = Array.from(doc.documentElement.attributes);
  for (const attr of rootAttrs) {
    const attrName = attr.name.toLowerCase();
    if (attrName.startsWith('on')) {
      doc.documentElement.removeAttribute(attr.name);
    }
    if (['href', 'xlink:href', 'src'].includes(attrName)) {
      if (attr.value.trim().toLowerCase().startsWith('javascript:')) {
        doc.documentElement.removeAttribute(attr.name);
      }
    }
  }

  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc.documentElement);
}

/**
 * Validate a file's MIME type against an allowed list.
 * @param {File} file - File object to validate
 * @param {string[]} allowedTypes - Array of allowed MIME type strings
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateFileType(file, allowedTypes) {
  if (!file || !file.type) {
    return { valid: false, error: 'No file provided or file type is unknown' };
  }

  if (!Array.isArray(allowedTypes) || allowedTypes.length === 0) {
    return { valid: false, error: 'No allowed file types specified' };
  }

  if (allowedTypes.includes(file.type)) {
    return { valid: true };
  }

  return {
    valid: false,
    error: `File type "${file.type}" is not allowed. Accepted types: ${allowedTypes.join(', ')}`,
  };
}

/**
 * Validate file content by checking magic bytes in the file header.
 * Supports PNG, JPEG, and SVG detection.
 * @param {ArrayBuffer} buffer - ArrayBuffer of the file's contents (at least first 8 bytes)
 * @returns {{ valid: boolean, detectedType?: string }}
 */
export function validateFileMagicBytes(buffer) {
  if (!buffer || !(buffer instanceof ArrayBuffer) || buffer.byteLength < 4) {
    return { valid: false };
  }

  const bytes = new Uint8Array(buffer);

  // PNG: starts with 0x89 0x50 0x4E 0x47 (‰PNG)
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { valid: true, detectedType: 'image/png' };
  }

  // JPEG: starts with 0xFF 0xD8 0xFF
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return { valid: true, detectedType: 'image/jpeg' };
  }

  // SVG: check for <svg in the text content
  try {
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(buffer);
    if (text.includes('<svg')) {
      return { valid: true, detectedType: 'image/svg+xml' };
    }
  } catch {
    // Not valid text, fall through
  }

  return { valid: false };
}
