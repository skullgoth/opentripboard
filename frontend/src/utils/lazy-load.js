// Lazy loading utility using Intersection Observer

let observer = null;

/**
 * Initialize the lazy loading observer
 * @returns {IntersectionObserver}
 */
function getObserver() {
  if (observer) return observer;

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const element = entry.target;
          loadImage(element);
          observer.unobserve(element);
        }
      });
    },
    {
      rootMargin: '50px 0px', // Start loading 50px before visible
      threshold: 0.01,
    }
  );

  return observer;
}

/**
 * Load the actual image
 * @param {HTMLElement} element
 */
function loadImage(element) {
  const src = element.dataset.src;
  const srcset = element.dataset.srcset;

  if (!src) return;

  if (element.tagName === 'IMG') {
    // For img elements
    element.src = src;
    if (srcset) {
      element.srcset = srcset;
    }
    element.removeAttribute('data-src');
    element.removeAttribute('data-srcset');
    element.classList.remove('lazy');
    element.classList.add('lazy-loaded');
  } else {
    // For background images (divs, etc.)
    element.style.backgroundImage = `url('${src}')`;
    element.removeAttribute('data-src');
    element.classList.remove('lazy');
    element.classList.add('lazy-loaded');
  }
}

/**
 * Register an element for lazy loading
 * @param {HTMLElement} element - Element with data-src attribute
 */
export function lazyLoad(element) {
  if (!element) return;

  // Check if IntersectionObserver is supported
  if (!('IntersectionObserver' in window)) {
    // Fallback: load immediately
    loadImage(element);
    return;
  }

  getObserver().observe(element);
}

/**
 * Register multiple elements for lazy loading
 * @param {NodeList|HTMLElement[]} elements
 */
export function lazyLoadAll(elements) {
  if (!elements) return;
  elements.forEach((element) => lazyLoad(element));
}

/**
 * Initialize lazy loading for all elements with .lazy class
 * Call this after DOM updates
 */
export function initLazyLoading() {
  const lazyElements = document.querySelectorAll('.lazy[data-src]');
  lazyLoadAll(lazyElements);
}

/**
 * Create a lazy-loadable image element
 * @param {string} src - Image source URL
 * @param {string} alt - Alt text
 * @param {string} className - Additional CSS classes
 * @param {string} placeholder - Placeholder image or color
 * @returns {string} HTML string
 */
export function lazyImage(src, alt = '', className = '', placeholder = '') {
  const placeholderStyle = placeholder
    ? `background-color: ${placeholder};`
    : 'background-color: var(--color-gray-200);';

  return `<img
    class="lazy ${className}"
    data-src="${escapeAttr(src)}"
    alt="${escapeAttr(alt)}"
    style="${placeholderStyle}"
    loading="lazy"
  />`;
}

/**
 * Create a lazy-loadable background image div
 * @param {string} src - Image source URL
 * @param {string} className - CSS classes
 * @param {string} placeholder - Placeholder color
 * @returns {string} HTML string
 */
export function lazyBackground(src, className = '', placeholder = '') {
  const placeholderStyle = placeholder
    ? `background-color: ${placeholder};`
    : 'background-color: var(--color-gray-200);';

  return `<div
    class="lazy ${className}"
    data-src="${escapeAttr(src)}"
    style="${placeholderStyle}"
  ></div>`;
}

/**
 * Escape attribute value for safe HTML insertion
 * @param {string} str
 * @returns {string}
 */
function escapeAttr(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Cleanup observer when no longer needed
 */
export function destroyLazyLoading() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}
