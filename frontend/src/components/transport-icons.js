// Transport mode icons as inline SVGs
// Uses currentColor for easy CSS styling

/**
 * Transport mode icons (24x24 viewBox, stroke-based)
 * Monochrome design for use with CSS currentColor
 */
const TRANSPORT_ICONS = {
  walk: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="4" r="2"/>
    <path d="M14 10l-1.5 5.5L15 22"/>
    <path d="M10 10l1.5 5.5L9 22"/>
    <path d="M10 10V7h4v3"/>
    <path d="M7 10h10"/>
  </svg>`,

  bike: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="5.5" cy="17.5" r="3.5"/>
    <circle cx="18.5" cy="17.5" r="3.5"/>
    <path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
    <path d="M12 17.5V14l-3-3 4-3 2 3h2"/>
  </svg>`,

  drive: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9L18 10l-2-4H8L6 10l-2.5 1.1C2.7 11.3 2 12.1 2 13v3c0 .6.4 1 1 1h2"/>
    <circle cx="7" cy="17" r="2"/>
    <circle cx="17" cy="17" r="2"/>
    <path d="M14 17H10"/>
  </svg>`,

  fly: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
  </svg>`,

  boat: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
    <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/>
    <path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/>
    <path d="M12 10V4.5"/>
    <path d="M12 4.5L7.5 9"/>
    <path d="M12 4.5l4.5 4.5"/>
  </svg>`,

  train: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="4" y="3" width="16" height="16" rx="2"/>
    <path d="M4 11h16"/>
    <path d="M12 3v8"/>
    <circle cx="8" cy="15" r="1"/>
    <circle cx="16" cy="15" r="1"/>
    <path d="M8 19l-2 3"/>
    <path d="M16 19l2 3"/>
  </svg>`,
};

/**
 * Get SVG icon for a transport mode
 * @param {string} mode - Transport mode (walk, bike, drive, fly, boat)
 * @param {Object} options - Options
 * @param {number} options.size - Icon size in pixels (default: 16)
 * @param {string} options.className - Additional CSS class
 * @returns {string} SVG HTML string
 */
export function getTransportIcon(mode, options = {}) {
  const { size = 16, className = '' } = options;

  const svg = TRANSPORT_ICONS[mode];
  if (!svg) {
    return '';
  }

  // Update size in the SVG
  const sizedSvg = svg
    .replace('width="24"', `width="${size}"`)
    .replace('height="24"', `height="${size}"`);

  // Wrap with class if provided
  if (className) {
    return sizedSvg.replace('<svg ', `<svg class="${className}" `);
  }

  return sizedSvg;
}

/**
 * Get all transport modes
 * @returns {string[]} Array of transport mode keys
 */
export function getTransportModes() {
  return Object.keys(TRANSPORT_ICONS);
}

/**
 * Check if a mode is valid
 * @param {string} mode - Transport mode to check
 * @returns {boolean} True if valid
 */
export function isValidTransportMode(mode) {
  return mode in TRANSPORT_ICONS;
}

export default TRANSPORT_ICONS;
