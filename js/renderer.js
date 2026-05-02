/**
 * QR code rendering engine.
 * Provides Canvas and SVG rendering with support for custom module styles,
 * corner eye styles, logo embedding, and quiet zone margins.
 * @module renderer
 */

import { calculateLogoPlacement } from './logo.js';

/**
 * Check if a module position is part of one of the three 7×7 finder patterns.
 * Finder patterns are located at:
 *   - Top-left: rows 0–6, cols 0–6
 *   - Top-right: rows 0–6, cols (size-7)–(size-1)
 *   - Bottom-left: rows (size-7)–(size-1), cols 0–6
 *
 * @param {number} row - Module row index
 * @param {number} col - Module column index
 * @param {number} matrixSize - Number of modules per side
 * @returns {boolean}
 */
export function isFinderPattern(row, col, matrixSize) {
  // Top-left
  if (row < 7 && col < 7) return true;
  // Top-right
  if (row < 7 && col >= matrixSize - 7) return true;
  // Bottom-left
  if (row >= matrixSize - 7 && col < 7) return true;
  return false;
}

/**
 * Check if a module position is the center 3×3 of one of the three finder patterns.
 * The center 3×3 sits at rows 2–4, cols 2–4 relative to each finder pattern origin.
 *
 * @param {number} row - Module row index
 * @param {number} col - Module column index
 * @param {number} matrixSize - Number of modules per side
 * @returns {boolean}
 */
export function isFinderCenter(row, col, matrixSize) {
  // Top-left center: rows 2–4, cols 2–4
  if (row >= 2 && row <= 4 && col >= 2 && col <= 4) return true;
  // Top-right center: rows 2–4, cols (size-5)–(size-3)
  if (row >= 2 && row <= 4 && col >= matrixSize - 5 && col <= matrixSize - 3) return true;
  // Bottom-left center: rows (size-5)–(size-3), cols 2–4
  if (row >= matrixSize - 5 && row <= matrixSize - 3 && col >= 2 && col <= 4) return true;
  return false;
}

/**
 * Get the origin (top-left corner) of the finder pattern that contains the given position.
 * Returns null if the position is not in a finder pattern.
 *
 * @param {number} row
 * @param {number} col
 * @param {number} matrixSize
 * @returns {{ originRow: number, originCol: number } | null}
 */
function getFinderPatternOrigin(row, col, matrixSize) {
  if (row < 7 && col < 7) return { originRow: 0, originCol: 0 };
  if (row < 7 && col >= matrixSize - 7) return { originRow: 0, originCol: matrixSize - 7 };
  if (row >= matrixSize - 7 && col < 7) return { originRow: matrixSize - 7, originCol: 0 };
  return null;
}

/**
 * Draw a single rounded rectangle on a Canvas 2D context.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} r - Corner radius
 */
function drawRoundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draw a circle on a Canvas 2D context.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} radius
 */
function drawCircle(ctx, cx, cy, radius) {
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draw the QR matrix to a Canvas 2D context.
 *
 * @param {HTMLCanvasElement} canvas - Target canvas element
 * @param {Object} options - Render options
 * @param {Object} options.matrix - QRMatrix with .size and .modules[][]
 * @param {string} options.foregroundColor - Hex color for dark modules
 * @param {string} options.backgroundColor - Hex color for light modules
 * @param {boolean} options.transparentBackground - If true, skip background fill
 * @param {string} options.moduleStyle - 'square' or 'rounded'
 * @param {string} options.cornerEyeStyle - 'square', 'rounded', or 'dot'
 * @param {Object|null} options.logo - Logo config: { image, maxAreaPercent, padding }
 * @param {number} options.quietZone - Quiet zone in modules
 * @param {number} options.size - Output pixel dimension
 */
export function renderToCanvas(canvas, options) {
  const {
    matrix,
    foregroundColor,
    backgroundColor,
    transparentBackground,
    moduleStyle,
    cornerEyeStyle,
    logo,
    quietZone,
    size,
  } = options;

  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  const totalModules = matrix.size + 2 * quietZone;
  const moduleSize = size / totalModules;

  // 1. Background
  if (!transparentBackground) {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, size, size);
  } else {
    ctx.clearRect(0, 0, size, size);
  }

  // 2. Draw modules
  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      const isDark = matrix.modules[row][col];
      if (!isDark) continue;

      const x = (col + quietZone) * moduleSize;
      const y = (row + quietZone) * moduleSize;

      const inFinder = isFinderPattern(row, col, matrix.size);

      if (inFinder) {
        // Finder pattern modules — use cornerEyeStyle
        drawFinderModule(ctx, row, col, matrix.size, x, y, moduleSize, foregroundColor, cornerEyeStyle);
      } else {
        // Regular data modules
        ctx.fillStyle = foregroundColor;
        if (moduleStyle === 'rounded') {
          const radius = moduleSize * 0.4;
          drawRoundedRect(ctx, x, y, moduleSize, moduleSize, radius);
        } else {
          ctx.fillRect(x, y, moduleSize, moduleSize);
        }
      }
    }
  }

  // 3. Logo overlay
  if (logo && logo.image) {
    const placement = calculateLogoPlacement(
      size,
      logo.image.naturalWidth || logo.image.width,
      logo.image.naturalHeight || logo.image.height,
      logo.maxAreaPercent || 0.30
    );

    // Clear the logo area (with padding) so modules don't show through
    const clearX = placement.x - placement.padding;
    const clearY = placement.y - placement.padding;
    const clearW = placement.scaledWidth + 2 * placement.padding;
    const clearH = placement.scaledHeight + 2 * placement.padding;

    if (!transparentBackground) {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(clearX, clearY, clearW, clearH);
    } else {
      ctx.clearRect(clearX, clearY, clearW, clearH);
    }

    // Draw the logo image
    ctx.drawImage(logo.image, placement.x, placement.y, placement.scaledWidth, placement.scaledHeight);
  }
}

/**
 * Draw a single finder pattern module on canvas, respecting the corner eye style.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} row
 * @param {number} col
 * @param {number} matrixSize
 * @param {number} x - Pixel X position
 * @param {number} y - Pixel Y position
 * @param {number} moduleSize
 * @param {string} color
 * @param {string} cornerEyeStyle - 'square', 'rounded', or 'dot'
 */
function drawFinderModule(ctx, row, col, matrixSize, x, y, moduleSize, color, cornerEyeStyle) {
  ctx.fillStyle = color;

  if (cornerEyeStyle === 'square') {
    // Standard square fill
    ctx.fillRect(x, y, moduleSize, moduleSize);
    return;
  }

  if (cornerEyeStyle === 'dot') {
    // For 'dot' style: draw the center 3×3 as circles, rest as rounded squares
    if (isFinderCenter(row, col, matrixSize)) {
      const cx = x + moduleSize / 2;
      const cy = y + moduleSize / 2;
      drawCircle(ctx, cx, cy, moduleSize / 2);
    } else {
      // Outer ring modules — use rounded rectangles
      const radius = moduleSize * 0.3;
      drawRoundedRect(ctx, x, y, moduleSize, moduleSize, radius);
    }
    return;
  }

  if (cornerEyeStyle === 'rounded') {
    // Rounded corners on the outer ring
    const radius = moduleSize;
    drawRoundedRect(ctx, x, y, moduleSize, moduleSize, radius);
    return;
  }

  // Fallback: square
  ctx.fillRect(x, y, moduleSize, moduleSize);
}

/**
 * Generate an SVG DOM element representing the QR code.
 *
 * @param {Object} options - Render options (same as renderToCanvas)
 * @param {Object} options.matrix - QRMatrix with .size and .modules[][]
 * @param {string} options.foregroundColor - Hex color for dark modules
 * @param {string} options.backgroundColor - Hex color for light modules
 * @param {boolean} options.transparentBackground - If true, omit background rect
 * @param {string} options.moduleStyle - 'square' or 'rounded'
 * @param {string} options.cornerEyeStyle - 'square', 'rounded', or 'dot'
 * @param {Object|null} options.logo - Logo config: { image, maxAreaPercent, padding }
 * @param {number} options.quietZone - Quiet zone in modules
 * @param {number} options.size - Output pixel dimension
 * @returns {SVGElement}
 */
export function renderToSVG(options) {
  const {
    matrix,
    foregroundColor,
    backgroundColor,
    transparentBackground,
    moduleStyle,
    cornerEyeStyle,
    logo,
    quietZone,
    size,
  } = options;

  const NS = 'http://www.w3.org/2000/svg';
  const totalModules = matrix.size + 2 * quietZone;
  const moduleSize = size / totalModules;

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('xmlns', NS);
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));

  // 1. Background
  if (!transparentBackground) {
    const bgRect = document.createElementNS(NS, 'rect');
    bgRect.setAttribute('width', String(size));
    bgRect.setAttribute('height', String(size));
    bgRect.setAttribute('fill', backgroundColor);
    svg.appendChild(bgRect);
  }

  // 2. Draw modules
  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      const isDark = matrix.modules[row][col];
      if (!isDark) continue;

      const x = (col + quietZone) * moduleSize;
      const y = (row + quietZone) * moduleSize;

      const inFinder = isFinderPattern(row, col, matrix.size);

      if (inFinder) {
        const el = createFinderSVGElement(NS, row, col, matrix.size, x, y, moduleSize, foregroundColor, cornerEyeStyle);
        svg.appendChild(el);
      } else {
        const rect = document.createElementNS(NS, 'rect');
        rect.setAttribute('x', String(x));
        rect.setAttribute('y', String(y));
        rect.setAttribute('width', String(moduleSize));
        rect.setAttribute('height', String(moduleSize));
        rect.setAttribute('fill', foregroundColor);

        if (moduleStyle === 'rounded') {
          const rx = moduleSize * 0.4;
          rect.setAttribute('rx', String(rx));
          rect.setAttribute('ry', String(rx));
        }

        svg.appendChild(rect);
      }
    }
  }

  // 3. Logo overlay
  if (logo && logo.image) {
    const imgWidth = logo.image.naturalWidth || logo.image.width;
    const imgHeight = logo.image.naturalHeight || logo.image.height;
    const placement = calculateLogoPlacement(
      size,
      imgWidth,
      imgHeight,
      logo.maxAreaPercent || 0.30
    );

    // Clear area behind logo with a background-colored rect (or white if transparent)
    const clearX = placement.x - placement.padding;
    const clearY = placement.y - placement.padding;
    const clearW = placement.scaledWidth + 2 * placement.padding;
    const clearH = placement.scaledHeight + 2 * placement.padding;

    if (!transparentBackground) {
      const clearRect = document.createElementNS(NS, 'rect');
      clearRect.setAttribute('x', String(clearX));
      clearRect.setAttribute('y', String(clearY));
      clearRect.setAttribute('width', String(clearW));
      clearRect.setAttribute('height', String(clearH));
      clearRect.setAttribute('fill', backgroundColor);
      svg.appendChild(clearRect);
    }

    // Add logo image element
    const imgEl = document.createElementNS(NS, 'image');
    imgEl.setAttribute('x', String(placement.x));
    imgEl.setAttribute('y', String(placement.y));
    imgEl.setAttribute('width', String(placement.scaledWidth));
    imgEl.setAttribute('height', String(placement.scaledHeight));

    // Use the image src — for SVG export this should be a data URL or external URL
    const src = logo.image.src || '';
    imgEl.setAttributeNS('http://www.w3.org/1999/xlink', 'href', src);
    imgEl.setAttribute('href', src);

    svg.appendChild(imgEl);
  }

  return svg;
}

/**
 * Create an SVG element for a single finder pattern module.
 *
 * @param {string} NS - SVG namespace
 * @param {number} row
 * @param {number} col
 * @param {number} matrixSize
 * @param {number} x - Pixel X position
 * @param {number} y - Pixel Y position
 * @param {number} moduleSize
 * @param {string} color
 * @param {string} cornerEyeStyle - 'square', 'rounded', or 'dot'
 * @returns {SVGElement}
 */
function createFinderSVGElement(NS, row, col, matrixSize, x, y, moduleSize, color, cornerEyeStyle) {
  if (cornerEyeStyle === 'dot' && isFinderCenter(row, col, matrixSize)) {
    // Draw center 3×3 modules as circles
    const circle = document.createElementNS(NS, 'circle');
    circle.setAttribute('cx', String(x + moduleSize / 2));
    circle.setAttribute('cy', String(y + moduleSize / 2));
    circle.setAttribute('r', String(moduleSize / 2));
    circle.setAttribute('fill', color);
    return circle;
  }

  const rect = document.createElementNS(NS, 'rect');
  rect.setAttribute('x', String(x));
  rect.setAttribute('y', String(y));
  rect.setAttribute('width', String(moduleSize));
  rect.setAttribute('height', String(moduleSize));
  rect.setAttribute('fill', color);

  if (cornerEyeStyle === 'rounded') {
    rect.setAttribute('rx', String(moduleSize));
    rect.setAttribute('ry', String(moduleSize));
  } else if (cornerEyeStyle === 'dot') {
    // Outer ring modules for dot style — slightly rounded
    const rx = moduleSize * 0.3;
    rect.setAttribute('rx', String(rx));
    rect.setAttribute('ry', String(rx));
  }

  return rect;
}

/**
 * Generate an SVG markup string for export.
 * Calls renderToSVG and serializes the result with XMLSerializer.
 *
 * @param {Object} options - Same options as renderToSVG
 * @returns {string} SVG markup string
 */
export function renderToSVGString(options) {
  const svgElement = renderToSVG(options);
  const serializer = new XMLSerializer();
  return serializer.serializeToString(svgElement);
}
