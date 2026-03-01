// Date navigation sidebar for trip detail page.
// Shows all trip dates as clickable links that scroll to the corresponding
// day section and highlights the currently visible date.

import { formatDate } from '../utils/date-helpers.js';

/**
 * Generate all dates between start and end (inclusive)
 * @param {string} startDate - ISO date string
 * @param {string} endDate - ISO date string
 * @returns {string[]} Array of YYYY-MM-DD strings
 */
function generateDateRange(startDate, endDate) {
  const dates = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Use UTC to avoid timezone shifts
  const current = new Date(
    Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
  );
  const last = new Date(
    Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())
  );

  while (current <= last) {
    const yyyy = current.getUTCFullYear();
    const mm = String(current.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(current.getUTCDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Create the date sidebar HTML
 * @param {Object} trip - Trip object with startDate and endDate
 * @returns {string} HTML string
 */
export function createDateSidebar(trip) {
  if (!trip.startDate || !trip.endDate) {
    return '';
  }

  const dates = generateDateRange(trip.startDate, trip.endDate);

  if (dates.length === 0) {
    return '';
  }

  const items = dates
    .map((date, index) => {
      const d = new Date(date + 'T00:00:00');
      const weekday = d.toLocaleDateString(undefined, { weekday: 'short' });
      const dayMonth = formatDate(date, 'short');
      const activeClass = index === 0 ? ' active' : '';

      return `
      <button
        class="date-sidebar-item${activeClass}"
        data-sidebar-date="${date}"
        title="${formatDate(date, 'full')}"
      >
        <span class="date-sidebar-weekday">${weekday}</span>
        <span class="date-sidebar-date">${dayMonth}</span>
      </button>`;
    })
    .join('');

  return `
    <nav class="date-sidebar" aria-label="Trip dates">
      ${items}
    </nav>
  `;
}

/**
 * Attach scroll sync and click listeners for the date sidebar.
 * @param {HTMLElement} container - The element containing both sidebar and timeline
 * @returns {Function} Cleanup function to disconnect observers
 */
export function attachDateSidebarListeners(container) {
  const sidebar = container.querySelector('.date-sidebar');
  if (!sidebar) return () => {};

  const scrollRoot = container.closest('.trip-content-section');
  if (!scrollRoot) return () => {};

  let observer = null;
  let isClickScrolling = false;
  let clickScrollTimer = null;

  function setupObserver() {
    // Disconnect previous observer if any
    if (observer) {
      observer.disconnect();
    }

    const dayElements = container.querySelectorAll('.timeline-day[data-date]');
    if (dayElements.length === 0) return;

    // Track which day is currently visible
    observer = new IntersectionObserver(
      (entries) => {
        // Skip observer updates while a click-scroll is animating
        if (isClickScrolling) return;

        // Find the topmost intersecting entry
        let topEntry = null;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (
              !topEntry ||
              entry.boundingClientRect.top < topEntry.boundingClientRect.top
            ) {
              topEntry = entry;
            }
          }
        }

        if (topEntry) {
          const date = topEntry.target.dataset.date;
          setActiveDate(sidebar, date);
        }
      },
      {
        root: scrollRoot,
        // Top 20% of viewport triggers, ignore bottom 70%
        rootMargin: '-10% 0px -70% 0px',
        threshold: 0,
      }
    );

    dayElements.forEach((el) => observer.observe(el));
  }

  function setActiveDate(sidebarEl, date) {
    const current = sidebarEl.querySelector('.date-sidebar-item.active');
    const next = sidebarEl.querySelector(
      `.date-sidebar-item[data-sidebar-date="${date}"]`
    );

    if (next && next !== current) {
      if (current) current.classList.remove('active');
      next.classList.add('active');

      // Auto-scroll sidebar only — use scrollTop to avoid scrolling ancestors
      const sidebarTop = sidebarEl.getBoundingClientRect().top;
      const itemTop = next.getBoundingClientRect().top;
      const itemBottom = next.getBoundingClientRect().bottom;
      const sidebarBottom = sidebarEl.getBoundingClientRect().bottom;

      if (itemTop < sidebarTop || itemBottom > sidebarBottom) {
        sidebarEl.scrollTop +=
          itemTop - sidebarTop - sidebarEl.clientHeight / 2 + next.clientHeight / 2;
      }
    }
  }

  // Click handler — scroll main content to the target day
  sidebar.addEventListener('click', (e) => {
    const item = e.target.closest('.date-sidebar-item');
    if (!item) return;

    const date = item.dataset.sidebarDate;
    const target = container.querySelector(
      `.timeline-day[data-date="${date}"]`
    );
    if (!target) return;

    // Immediately update the active sidebar item
    const current = sidebar.querySelector('.date-sidebar-item.active');
    if (current) current.classList.remove('active');
    item.classList.add('active');

    // Guard: suppress observer updates during animated scroll
    isClickScrolling = true;
    if (clickScrollTimer) clearTimeout(clickScrollTimer);

    // Scroll the timeline to the target day
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Re-enable observer after scroll settles
    clickScrollTimer = setTimeout(() => {
      isClickScrolling = false;
    }, 800);
  });

  // Initial setup
  setupObserver();

  // Return cleanup + re-init handle
  const cleanup = () => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  };

  // Expose re-init for timeline refreshes
  cleanup.reinit = setupObserver;

  return cleanup;
}
