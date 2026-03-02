// Reusable category select component
// Dropdown for selecting categories (defaults + custom) in trip forms
// T057: Added searchable dropdown for users with many categories

import { t } from '../utils/i18n.js';
import { escapeHtml } from '../utils/html.js';
import { getAllCategoriesForDomain, getCategoriesByDomain } from '../state/categories-state.js';
import { fetchTripCategories } from '../services/categories.js';
import { buildCategoryOptions, resolveCategory } from '../utils/category-resolver.js';
import { logError } from '../utils/error-tracking.js';

// Threshold for showing search input (when total categories exceed this)
const SEARCH_THRESHOLD = 10;

/**
 * Create a category select dropdown
 * @param {Object} options - Configuration options
 * @param {HTMLElement} options.container - Container element
 * @param {string} options.domain - Category domain (activity, expense, document)
 * @param {string} options.value - Initial selected value
 * @param {Function} options.onChange - Callback when selection changes
 * @param {string} options.tripId - Trip ID (for fetching owner's categories)
 * @param {string} options.id - Element ID
 * @param {string} options.name - Form field name
 * @param {boolean} options.required - Whether selection is required
 * @param {string} options.placeholder - Placeholder text
 * @param {boolean} options.searchable - Force searchable mode (auto-enabled when categories > threshold)
 * @returns {Object} - Category select API
 */
export function createCategorySelect(options) {
  const {
    container,
    domain,
    value = '',
    onChange,
    tripId = null,
    id = `category-select-${domain}`,
    name = 'category',
    required = false,
    placeholder = '',
    searchable = false,
  } = options;

  // State
  let currentValue = value;
  let categories = null;
  let isLoading = false;
  let useSearchable = searchable;
  let isDropdownOpen = false;
  let searchQuery = '';
  let focusedIndex = -1;
  let allOptions = []; // Flat list of all options for keyboard navigation

  // Create wrapper
  const wrapper = document.createElement('div');
  wrapper.className = 'category-select';

  // Elements (will be created based on mode)
  let select = null;
  let searchableContainer = null;
  let triggerBtn = null;
  let dropdown = null;
  let searchInput = null;
  let optionsList = null;
  let hiddenInput = null;

  // Create initial loading state
  createLoadingState();
  container.appendChild(wrapper);

  /**
   * Create loading state placeholder
   */
  function createLoadingState() {
    const loadingEl = document.createElement('div');
    loadingEl.className = 'category-select-loading';
    loadingEl.innerHTML = `<span class="category-select-loading-text">${t('common.loading') || 'Loading...'}</span>`;
    wrapper.appendChild(loadingEl);
  }

  /**
   * Create native select element (for fewer categories)
   */
  function createNativeSelect() {
    select = document.createElement('select');
    select.id = id;
    select.name = name;
    select.className = 'category-select-input form-select';
    select.required = required;

    select.addEventListener('change', () => {
      currentValue = select.value;
      triggerOnChange();
    });

    return select;
  }

  /**
   * Create searchable dropdown (for many categories)
   * T057: Custom dropdown with search input
   */
  function createSearchableDropdown() {
    searchableContainer = document.createElement('div');
    searchableContainer.className = 'category-select-searchable';

    // Hidden input for form submission
    hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.id = id;
    hiddenInput.name = name;
    hiddenInput.value = currentValue;
    if (required) {
      hiddenInput.required = true;
    }
    searchableContainer.appendChild(hiddenInput);

    // Trigger button
    triggerBtn = document.createElement('button');
    triggerBtn.type = 'button';
    triggerBtn.className = 'category-select-trigger';
    triggerBtn.setAttribute('aria-haspopup', 'listbox');
    triggerBtn.setAttribute('aria-expanded', 'false');
    updateTriggerDisplay();
    searchableContainer.appendChild(triggerBtn);

    // Dropdown container
    dropdown = document.createElement('div');
    dropdown.className = 'category-select-dropdown';
    dropdown.setAttribute('role', 'listbox');
    dropdown.style.display = 'none';

    // Search input
    const searchWrapper = document.createElement('div');
    searchWrapper.className = 'category-select-search';
    searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'category-select-search-input';
    searchInput.placeholder = t('common.search') || 'Search...';
    searchInput.setAttribute('aria-label', t('common.search') || 'Search categories');
    searchWrapper.appendChild(searchInput);
    dropdown.appendChild(searchWrapper);

    // Options list
    optionsList = document.createElement('div');
    optionsList.className = 'category-select-options';
    dropdown.appendChild(optionsList);

    searchableContainer.appendChild(dropdown);

    // Event listeners
    triggerBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleDropdown();
    });

    triggerBtn.addEventListener('keydown', handleTriggerKeydown);

    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value.toLowerCase();
      renderSearchableOptions();
    });

    searchInput.addEventListener('keydown', handleSearchKeydown);

    optionsList.addEventListener('click', handleOptionClick);

    return searchableContainer;
  }

  /**
   * Update trigger button display text
   */
  function updateTriggerDisplay() {
    if (!triggerBtn) return;

    if (currentValue) {
      const info = getDisplayInfo();
      triggerBtn.innerHTML = `
        <span class="category-select-trigger-icon">${info.icon}</span>
        <span class="category-select-trigger-text">${escapeHtml(info.name)}</span>
        <span class="category-select-trigger-arrow">▼</span>
      `;
    } else {
      triggerBtn.innerHTML = `
        <span class="category-select-trigger-text category-select-placeholder">${placeholder || t('settings.tripCategories.selectDomain') || 'Select...'}</span>
        <span class="category-select-trigger-arrow">▼</span>
      `;
    }
  }

  /**
   * Toggle dropdown open/closed
   */
  function toggleDropdown() {
    if (isDropdownOpen) {
      closeDropdown();
    } else {
      openDropdown();
    }
  }

  /**
   * Open the dropdown
   */
  function openDropdown() {
    if (isDropdownOpen) return;
    isDropdownOpen = true;
    dropdown.style.display = 'block';
    triggerBtn.setAttribute('aria-expanded', 'true');
    wrapper.classList.add('open');
    searchInput.value = '';
    searchQuery = '';
    renderSearchableOptions();
    searchInput.focus();

    // Add click outside listener
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);
  }

  /**
   * Close the dropdown
   */
  function closeDropdown() {
    if (!isDropdownOpen) return;
    isDropdownOpen = false;
    dropdown.style.display = 'none';
    triggerBtn.setAttribute('aria-expanded', 'false');
    wrapper.classList.remove('open');
    focusedIndex = -1;
    document.removeEventListener('click', handleClickOutside);
  }

  /**
   * Handle click outside dropdown
   */
  function handleClickOutside(e) {
    if (!wrapper.contains(e.target)) {
      closeDropdown();
    }
  }

  /**
   * Handle trigger button keydown
   */
  function handleTriggerKeydown(e) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      openDropdown();
    }
  }

  /**
   * Handle search input keydown
   */
  function handleSearchKeydown(e) {
    const visibleOptions = optionsList.querySelectorAll('.category-select-option:not(.hidden)');
    const totalVisible = visibleOptions.length;

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        closeDropdown();
        triggerBtn.focus();
        break;

      case 'ArrowDown':
        e.preventDefault();
        focusedIndex = Math.min(focusedIndex + 1, totalVisible - 1);
        updateFocusedOption(visibleOptions);
        break;

      case 'ArrowUp':
        e.preventDefault();
        focusedIndex = Math.max(focusedIndex - 1, 0);
        updateFocusedOption(visibleOptions);
        break;

      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < totalVisible) {
          const focusedOption = visibleOptions[focusedIndex];
          selectOption(focusedOption.dataset.value);
        }
        break;

      case 'Tab':
        closeDropdown();
        break;
    }
  }

  /**
   * Update focused option visual state
   */
  function updateFocusedOption(visibleOptions) {
    visibleOptions.forEach((opt, i) => {
      opt.classList.toggle('focused', i === focusedIndex);
      if (i === focusedIndex) {
        opt.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  /**
   * Handle option click
   */
  function handleOptionClick(e) {
    const option = e.target.closest('.category-select-option');
    if (option && !option.classList.contains('disabled')) {
      selectOption(option.dataset.value);
    }
  }

  /**
   * Select an option by value
   */
  function selectOption(optionValue) {
    currentValue = optionValue;
    if (hiddenInput) {
      hiddenInput.value = optionValue;
    }
    updateTriggerDisplay();
    closeDropdown();
    triggerBtn.focus();
    triggerOnChange();
  }

  /**
   * Trigger onChange callback
   */
  function triggerOnChange() {
    if (onChange) {
      const info = getDisplayInfo();
      onChange({
        value: currentValue,
        icon: info.icon,
        label: info.name,
        isCustom: currentValue.startsWith('custom:'),
      });
    }
  }

  /**
   * Load categories (from state or API)
   */
  async function loadCategories() {
    if (isLoading) return;
    isLoading = true;

    try {
      // If tripId is provided, fetch trip owner's categories
      if (tripId) {
        const tripCategories = await fetchTripCategories(tripId);
        categories = {
          defaults: tripCategories.defaults[domain] || [],
          custom: tripCategories.custom[domain] || [],
        };
      } else {
        // Use current user's categories from state
        categories = getCategoriesByDomain(domain);
      }

      // Determine if we should use searchable mode
      const totalCategories = (categories.defaults?.length || 0) + (categories.custom?.length || 0);
      useSearchable = searchable || totalCategories > SEARCH_THRESHOLD;

      // Clear loading state and create appropriate UI
      wrapper.innerHTML = '';

      if (useSearchable) {
        wrapper.appendChild(createSearchableDropdown());
        renderSearchableOptions();
        updateTriggerDisplay();
      } else {
        wrapper.appendChild(createNativeSelect());
        renderNativeOptions();
      }
    } catch (error) {
      logError('Failed to load categories:', error);
      // Fallback to defaults only
      categories = getCategoriesByDomain(domain);
      wrapper.innerHTML = '';
      wrapper.appendChild(createNativeSelect());
      renderNativeOptions();
    } finally {
      isLoading = false;
    }
  }

  /**
   * Render native select options
   */
  function renderNativeOptions() {
    if (!select) return;
    select.innerHTML = '';

    // Placeholder option
    const placeholderOpt = document.createElement('option');
    placeholderOpt.value = '';
    placeholderOpt.textContent = placeholder || (t('settings.tripCategories.selectDomain') || 'Select...');
    if (!currentValue) {
      placeholderOpt.selected = true;
    }
    if (required) {
      placeholderOpt.disabled = true;
    }
    select.appendChild(placeholderOpt);

    if (!categories) return;

    // Build options structure
    const optionGroups = buildCategoryOptions(domain, categories.defaults, categories.custom);

    // Render options
    optionGroups.forEach((item) => {
      if (item.groupLabel) {
        // This is an optgroup
        const optgroup = document.createElement('optgroup');
        optgroup.label = item.groupLabel;

        item.options.forEach((opt) => {
          const option = createNativeOption(opt);
          optgroup.appendChild(option);
        });

        select.appendChild(optgroup);
      } else {
        // This is a single option
        const option = createNativeOption(item);
        select.appendChild(option);
      }
    });
  }

  /**
   * Create a native option element
   * @param {Object} opt - Option data
   * @returns {HTMLOptionElement} Option element
   */
  function createNativeOption(opt) {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = `${opt.icon} ${opt.label}`;
    option.dataset.icon = opt.icon;
    option.dataset.isCustom = opt.isCustom || false;

    if (opt.value === currentValue) {
      option.selected = true;
    }

    return option;
  }

  /**
   * Render searchable dropdown options
   * T057: Renders options with search filtering
   */
  function renderSearchableOptions() {
    if (!optionsList) return;
    optionsList.innerHTML = '';
    allOptions = [];
    focusedIndex = -1;

    if (!categories) return;

    // Build options structure
    const optionGroups = buildCategoryOptions(domain, categories.defaults, categories.custom);

    // Render options with groups
    optionGroups.forEach((item) => {
      if (item.groupLabel) {
        // Create group header
        const groupHeader = document.createElement('div');
        groupHeader.className = 'category-select-group-header';
        groupHeader.textContent = item.groupLabel;

        // Check if any options in this group match the search
        const matchingOptions = item.options.filter((opt) =>
          matchesSearch(opt.label, opt.icon)
        );

        if (matchingOptions.length > 0 || !searchQuery) {
          groupHeader.classList.toggle('hidden', matchingOptions.length === 0);
          optionsList.appendChild(groupHeader);
        }

        // Render group options
        item.options.forEach((opt) => {
          const optionEl = createSearchableOption(opt);
          optionsList.appendChild(optionEl);
          allOptions.push(opt);
        });
      } else {
        // Single option (not in a group)
        const optionEl = createSearchableOption(item);
        optionsList.appendChild(optionEl);
        allOptions.push(item);
      }
    });

    // Show "no results" message if needed
    const visibleOptions = optionsList.querySelectorAll('.category-select-option:not(.hidden)');
    let noResults = optionsList.querySelector('.category-select-no-results');

    if (visibleOptions.length === 0 && searchQuery) {
      if (!noResults) {
        noResults = document.createElement('div');
        noResults.className = 'category-select-no-results';
        noResults.textContent = t('common.noResults') || 'No results found';
        optionsList.appendChild(noResults);
      }
      noResults.classList.remove('hidden');
    } else if (noResults) {
      noResults.classList.add('hidden');
    }
  }

  /**
   * Check if option matches current search query
   */
  function matchesSearch(label, icon) {
    if (!searchQuery) return true;
    const searchText = `${icon} ${label}`.toLowerCase();
    return searchText.includes(searchQuery);
  }

  /**
   * Create a searchable option element
   */
  function createSearchableOption(opt) {
    const optionEl = document.createElement('div');
    optionEl.className = 'category-select-option';
    optionEl.dataset.value = opt.value;
    optionEl.setAttribute('role', 'option');

    if (opt.value === currentValue) {
      optionEl.classList.add('selected');
      optionEl.setAttribute('aria-selected', 'true');
    }

    if (opt.isCustom) {
      optionEl.classList.add('custom');
    }

    // Check if matches search
    const matches = matchesSearch(opt.label, opt.icon);
    optionEl.classList.toggle('hidden', !matches);

    optionEl.innerHTML = `
      <span class="category-select-option-icon">${opt.icon}</span>
      <span class="category-select-option-label">${escapeHtml(opt.label)}</span>
      ${opt.value === currentValue ? '<span class="category-select-option-check">✓</span>' : ''}
    `;

    return optionEl;
  }

  /**
   * Get display info for current value
   * @returns {Object} Resolved category info
   */
  function getDisplayInfo() {
    return resolveCategory(currentValue, domain, categories?.custom);
  }

  // Initial load
  loadCategories();

  // API
  return {
    /**
     * Get current value
     * @returns {string} Selected category value
     */
    getValue() {
      return currentValue;
    },

    /**
     * Set value
     * @param {string} newValue - New value to select
     */
    setValue(newValue) {
      currentValue = newValue;
      if (useSearchable) {
        if (hiddenInput) {
          hiddenInput.value = newValue;
        }
        updateTriggerDisplay();
        if (optionsList) {
          // Update selected state in options
          const options = optionsList.querySelectorAll('.category-select-option');
          options.forEach((opt) => {
            const isSelected = opt.dataset.value === newValue;
            opt.classList.toggle('selected', isSelected);
            opt.setAttribute('aria-selected', isSelected ? 'true' : 'false');
          });
        }
      } else if (select) {
        select.value = newValue;
      }
    },

    /**
     * Get display info for current selection
     * @returns {Object} Resolved category info
     */
    getDisplayInfo,

    /**
     * Refresh categories from API
     */
    refresh: loadCategories,

    /**
     * Enable the select
     */
    enable() {
      if (useSearchable && triggerBtn) {
        triggerBtn.disabled = false;
      } else if (select) {
        select.disabled = false;
      }
    },

    /**
     * Disable the select
     */
    disable() {
      if (useSearchable && triggerBtn) {
        triggerBtn.disabled = true;
        closeDropdown();
      } else if (select) {
        select.disabled = true;
      }
    },

    /**
     * Destroy the component
     */
    destroy() {
      if (isDropdownOpen) {
        document.removeEventListener('click', handleClickOutside);
      }
      wrapper.remove();
    },

    /**
     * Get the select element (or hidden input for searchable)
     * @returns {HTMLSelectElement|HTMLInputElement} Input element
     */
    getElement() {
      return useSearchable ? hiddenInput : select;
    },

    /**
     * Get the wrapper element
     * @returns {HTMLElement} Wrapper element
     */
    getWrapper() {
      return wrapper;
    },

    /**
     * Check if searchable mode is active
     * @returns {boolean} True if using searchable dropdown
     */
    isSearchable() {
      return useSearchable;
    },
  };
}

/**
 * Simple function to create a category select and return its HTML
 * For use in templates that need immediate HTML
 * @param {Object} options - Options
 * @returns {string} HTML string for a select element
 */
export function createCategorySelectHTML(options) {
  const {
    domain,
    value = '',
    id = `category-select-${domain}`,
    name = 'category',
    required = false,
    className = 'form-select',
  } = options;

  // Get categories from state
  const categories = getCategoriesByDomain(domain);
  const optionGroups = buildCategoryOptions(domain, categories.defaults, categories.custom);

  let html = `<select id="${id}" name="${name}" class="${className}" ${required ? 'required' : ''}>`;

  // Placeholder
  html += `<option value="" ${!value ? 'selected' : ''} ${required ? 'disabled' : ''}>`;
  html += `${t('settings.tripCategories.selectDomain') || 'Select...'}</option>`;

  // Render options
  optionGroups.forEach((item) => {
    if (item.groupLabel) {
      html += `<optgroup label="${escapeHtml(item.groupLabel)}">`;
      item.options.forEach((opt) => {
        html += `<option value="${escapeHtml(opt.value)}" ${opt.value === value ? 'selected' : ''} data-icon="${opt.icon}">${opt.icon} ${escapeHtml(opt.label)}</option>`;
      });
      html += `</optgroup>`;
    } else {
      html += `<option value="${escapeHtml(item.value)}" ${item.value === value ? 'selected' : ''} data-icon="${item.icon}">${item.icon} ${escapeHtml(item.label)}</option>`;
    }
  });

  html += `</select>`;

  return html;
}

export default createCategorySelect;
