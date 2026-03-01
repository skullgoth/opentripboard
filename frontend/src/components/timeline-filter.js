/**
 * Timeline Filter Component
 * Provides search and filter capabilities for the unified timeline.
 * CSS-based filtering — toggles display:none on non-matching items.
 */
import { t } from '../utils/i18n.js';
import { ACTIVITY_GROUPS, getTypeGroup } from '../utils/default-categories.js';
import { escapeHtml } from '../utils/html.js';

/**
 * Create timeline filter bar HTML
 * @param {Object} trip - Trip object (for date constraints)
 * @returns {string} HTML string
 */
export function createTimelineFilter(trip) {
  const minDate = trip.startDate ? trip.startDate.split('T')[0] : '';
  const maxDate = trip.endDate ? trip.endDate.split('T')[0] : '';

  const groupPills = ACTIVITY_GROUPS.map(
    (g) =>
      `<button class="filter-tab" data-filter-group="${g.key}">${t(g.i18nKey) || g.key}</button>`
  ).join('');

  return `
    <div class="timeline-filter-bar">
      <button class="btn btn-sm btn-ghost timeline-filter-toggle" data-action="toggle-filter" title="${t('filter.showFilters')}">
        🔍 ${t('filter.filterActivities')}
        <span class="timeline-filter-badge" style="display:none;">0</span>
      </button>
      <div class="timeline-filter-panel" style="display:none;">
        <div class="timeline-filter-row">
          <div class="timeline-filter-field timeline-filter-field--text">
            <label class="timeline-filter-label">${t('filter.searchText')}</label>
            <input type="text" class="form-input form-input-sm timeline-filter-input" data-filter="text" placeholder="${t('filter.searchPlaceholder')}" />
          </div>
          <div class="timeline-filter-field timeline-filter-field--location">
            <label class="timeline-filter-label">${t('filter.location')}</label>
            <input type="text" class="form-input form-input-sm timeline-filter-input" data-filter="location" placeholder="${t('filter.locationPlaceholder')}" />
          </div>
        </div>
        <div class="timeline-filter-row">
          <div class="timeline-filter-field timeline-filter-field--dates">
            <label class="timeline-filter-label">${t('filter.dateRange')}</label>
            <div class="timeline-filter-dates">
              <input type="date" class="form-input form-input-sm" data-filter="dateFrom" ${minDate ? `min="${minDate}"` : ''} ${maxDate ? `max="${maxDate}"` : ''} />
              <span class="timeline-filter-date-sep">–</span>
              <input type="date" class="form-input form-input-sm" data-filter="dateTo" ${minDate ? `min="${minDate}"` : ''} ${maxDate ? `max="${maxDate}"` : ''} />
            </div>
          </div>
        </div>
        <div class="timeline-filter-row timeline-filter-row--groups">
          <label class="timeline-filter-label">${t('filter.category')}</label>
          <div class="timeline-filter-groups">
            <button class="filter-tab active" data-filter-group="all">${t('filter.all')}</button>
            ${groupPills}
          </div>
        </div>
        <div class="timeline-filter-row timeline-filter-row--actions">
          <span class="timeline-filter-count"></span>
          <button class="btn btn-sm btn-ghost timeline-filter-clear" data-action="clear-filters">${t('filter.clearFilters')}</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Attach timeline filter listeners
 * @param {HTMLElement} filterBar - The .timeline-filter-bar element
 * @param {HTMLElement} timelineContainer - The .unified-timeline element
 * @returns {{ applyFilters: Function, getFilterState: Function, setFilterState: Function, cleanup: Function }}
 */
export function attachTimelineFilterListeners(filterBar, timelineContainer) {
  const filterState = { text: '', group: 'all', dateFrom: '', dateTo: '', location: '' };
  let debounceTimer = null;

  // Elements
  const toggleBtn = filterBar.querySelector('[data-action="toggle-filter"]');
  const panel = filterBar.querySelector('.timeline-filter-panel');
  const badge = filterBar.querySelector('.timeline-filter-badge');
  const textInput = filterBar.querySelector('[data-filter="text"]');
  const locationInput = filterBar.querySelector('[data-filter="location"]');
  const dateFromInput = filterBar.querySelector('[data-filter="dateFrom"]');
  const dateToInput = filterBar.querySelector('[data-filter="dateTo"]');
  const clearBtn = filterBar.querySelector('[data-action="clear-filters"]');
  const countSpan = filterBar.querySelector('.timeline-filter-count');
  const groupBtns = filterBar.querySelectorAll('[data-filter-group]');

  // Toggle panel
  toggleBtn?.addEventListener('click', () => {
    const visible = panel.style.display !== 'none';
    panel.style.display = visible ? 'none' : 'block';
  });

  // Text search (debounced)
  textInput?.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      filterState.text = textInput.value.trim().toLowerCase();
      applyFilters();
    }, 200);
  });

  // Location search (debounced)
  locationInput?.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      filterState.location = locationInput.value.trim().toLowerCase();
      applyFilters();
    }, 200);
  });

  // Date inputs
  dateFromInput?.addEventListener('change', () => {
    filterState.dateFrom = dateFromInput.value;
    applyFilters();
  });
  dateToInput?.addEventListener('change', () => {
    filterState.dateTo = dateToInput.value;
    applyFilters();
  });

  // Category group pills
  groupBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      groupBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      filterState.group = btn.dataset.filterGroup;
      applyFilters();
    });
  });

  // Clear filters
  clearBtn?.addEventListener('click', () => {
    filterState.text = '';
    filterState.group = 'all';
    filterState.dateFrom = '';
    filterState.dateTo = '';
    filterState.location = '';
    if (textInput) textInput.value = '';
    if (locationInput) locationInput.value = '';
    if (dateFromInput) dateFromInput.value = '';
    if (dateToInput) dateToInput.value = '';
    groupBtns.forEach((b) => b.classList.remove('active'));
    filterBar.querySelector('[data-filter-group="all"]')?.classList.add('active');
    applyFilters();
  });

  function isFilterActive() {
    return (
      filterState.text !== '' ||
      filterState.group !== 'all' ||
      filterState.dateFrom !== '' ||
      filterState.dateTo !== '' ||
      filterState.location !== ''
    );
  }

  function countActiveFilters() {
    let count = 0;
    if (filterState.text) count++;
    if (filterState.group !== 'all') count++;
    if (filterState.dateFrom || filterState.dateTo) count++;
    if (filterState.location) count++;
    return count;
  }

  function applyFilters() {
    const active = isFilterActive();
    const activeCount = countActiveFilters();

    // Update badge
    if (badge) {
      badge.style.display = activeCount > 0 ? 'inline-flex' : 'none';
      badge.textContent = activeCount;
    }

    // Toggle filtered class (disables drag handles via CSS)
    timelineContainer.classList.toggle('timeline--filtered', active);

    const items = timelineContainer.querySelectorAll('.timeline-item[data-item-type="activity"]');
    let visibleCount = 0;

    items.forEach((item) => {
      const matches = matchesFilter(item);
      item.style.display = matches ? '' : 'none';

      // Also hide/show adjacent transport lines
      const nextSibling = item.nextElementSibling;
      if (nextSibling?.classList.contains('transport-line')) {
        nextSibling.style.display = matches ? '' : 'none';
      }

      if (matches) visibleCount++;
    });

    // Also hide suggestion items if any filter is active (they don't match activity filters)
    const suggestions = timelineContainer.querySelectorAll(
      '.timeline-item[data-item-type="suggestion"]'
    );
    suggestions.forEach((s) => {
      s.style.display = active ? 'none' : '';
    });

    // Hide empty day sections
    const days = timelineContainer.querySelectorAll('.timeline-day');
    days.forEach((day) => {
      const visibleItems = day.querySelectorAll(
        '.timeline-item[data-item-type="activity"]:not([style*="display: none"])'
      );
      const visibleSuggestions = day.querySelectorAll(
        '.timeline-item[data-item-type="suggestion"]:not([style*="display: none"])'
      );
      day.style.display =
        visibleItems.length > 0 || visibleSuggestions.length > 0 || !active ? '' : 'none';
    });

    // Hide orphaned transport lines at the start of days (before first hidden item)
    days.forEach((day) => {
      const dayItems = day.querySelector('.timeline-day-items');
      if (!dayItems) return;
      const children = Array.from(dayItems.children);
      for (const child of children) {
        if (child.classList.contains('transport-line')) {
          // Check if the next item is hidden
          const nextItem = child.nextElementSibling;
          if (nextItem && nextItem.style.display === 'none') {
            child.style.display = 'none';
          }
        } else {
          break;
        }
      }
    });

    // Show/hide "no results" message
    let noResultsEl = timelineContainer.querySelector('.timeline-filter-no-results');
    if (active && visibleCount === 0) {
      if (!noResultsEl) {
        noResultsEl = document.createElement('div');
        noResultsEl.className = 'timeline-filter-no-results';
        noResultsEl.textContent = t('filter.noResults');
        const content = timelineContainer.querySelector('.timeline-content');
        if (content) {
          content.prepend(noResultsEl);
        }
      }
      noResultsEl.style.display = '';
    } else if (noResultsEl) {
      noResultsEl.style.display = 'none';
    }

    // Update count
    if (countSpan) {
      const totalItems = items.length;
      countSpan.textContent = active
        ? t('filter.resultCount', { count: visibleCount, total: totalItems })
        : '';
    }
  }

  function matchesFilter(item) {
    let activityData;
    try {
      activityData = JSON.parse(item.dataset.activityData || '{}');
    } catch {
      activityData = {};
    }

    // Text search (title + description)
    if (filterState.text) {
      const title = (activityData.title || '').toLowerCase();
      const description = (activityData.description || '').toLowerCase();
      if (!title.includes(filterState.text) && !description.includes(filterState.text)) {
        return false;
      }
    }

    // Location search
    if (filterState.location) {
      const location = (activityData.location || '').toLowerCase();
      if (!location.includes(filterState.location)) {
        return false;
      }
    }

    // Category group
    if (filterState.group !== 'all') {
      const activityType = item.dataset.activityType || '';
      const group = getTypeGroup(activityType);
      if (group !== filterState.group) {
        return false;
      }
    }

    // Date range
    if (filterState.dateFrom || filterState.dateTo) {
      const dayEl = item.closest('.timeline-day');
      const dayDate = dayEl?.dataset.date || '';
      if (filterState.dateFrom && dayDate < filterState.dateFrom) {
        return false;
      }
      if (filterState.dateTo && dayDate > filterState.dateTo) {
        return false;
      }
    }

    return true;
  }

  function getFilterState() {
    return { ...filterState };
  }

  function setFilterState(state) {
    Object.assign(filterState, state);
    // Restore input values
    if (textInput) textInput.value = filterState.text;
    if (locationInput) locationInput.value = filterState.location;
    if (dateFromInput) dateFromInput.value = filterState.dateFrom;
    if (dateToInput) dateToInput.value = filterState.dateTo;
    // Restore group pill
    groupBtns.forEach((b) => {
      b.classList.toggle('active', b.dataset.filterGroup === filterState.group);
    });
    // Show panel if filters are active
    if (isFilterActive() && panel) {
      panel.style.display = 'block';
    }
    applyFilters();
  }

  function cleanup() {
    clearTimeout(debounceTimer);
  }

  return { applyFilters, getFilterState, setFilterState, cleanup };
}
