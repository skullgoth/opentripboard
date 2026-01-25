// T015: Reusable Autocomplete component with debouncing, keyboard navigation, and ARIA attributes

/**
 * Create an autocomplete component
 * @param {Object} options - Configuration options
 * @param {HTMLElement} options.container - Container element
 * @param {Function} options.onSearch - Search function: (query) => Promise<Array>
 * @param {Function} options.onSelect - Selection callback: (item) => void
 * @param {Function} options.formatResult - Format result for display: (item) => string
 * @param {Function} options.getItemValue - Get value from item: (item) => string
 * @param {string} options.placeholder - Input placeholder text
 * @param {number} options.debounceMs - Debounce delay in milliseconds (default 300)
 * @param {number} options.minChars - Minimum characters to trigger search (default 2)
 * @param {string} options.noResultsText - Text to show when no results found
 * @param {string} options.loadingText - Text to show while loading
 * @param {string} options.errorText - Text to show on error
 * @returns {Object} - Autocomplete API
 */
export function createAutocomplete(options) {
  const {
    container,
    onSearch,
    onSelect,
    formatResult,
    getItemValue,
    placeholder = 'Search...',
    debounceMs = 300,
    minChars = 2,
    noResultsText = 'No results found',
    loadingText = 'Searching...',
    errorText = 'Search unavailable. Please try again.',
  } = options;

  // State
  let results = [];
  let selectedIndex = -1;
  let debounceTimer = null;
  let isOpen = false;
  let currentQuery = '';
  let isLoading = false;
  let hasError = false;

  // Create elements
  const inputWrapper = document.createElement('div');
  inputWrapper.className = 'autocomplete-wrapper';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'autocomplete-input';
  input.placeholder = placeholder;
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', 'autocomplete-listbox');

  const dropdown = document.createElement('ul');
  dropdown.id = 'autocomplete-listbox';
  dropdown.className = 'autocomplete-dropdown';
  dropdown.setAttribute('role', 'listbox');
  dropdown.style.display = 'none';

  const liveRegion = document.createElement('div');
  liveRegion.className = 'sr-only';
  liveRegion.setAttribute('role', 'status');
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');

  inputWrapper.appendChild(input);
  inputWrapper.appendChild(dropdown);
  inputWrapper.appendChild(liveRegion);
  container.appendChild(inputWrapper);

  // Event delegation for dropdown clicks - more reliable than per-item listeners
  dropdown.addEventListener('mousedown', (e) => {
    e.preventDefault(); // Prevent input blur

    // Try to find the clicked item - first check if target is or contains an item
    let item = e.target.closest('.autocomplete-item[data-index]');

    // If not found (clicking on UL padding), use elementFromPoint to find actual element
    if (!item) {
      const elementUnderCursor = document.elementFromPoint(e.clientX, e.clientY);
      item = elementUnderCursor?.closest('.autocomplete-item[data-index]');
    }

    // If still not found, try to get item from dropdown children at click position
    if (!item) {
      for (const child of dropdown.children) {
        const childRect = child.getBoundingClientRect();
        if (e.clientY >= childRect.top && e.clientY <= childRect.bottom) {
          if (child.dataset.index !== undefined) {
            item = child;
            break;
          }
        }
      }
    }

    if (item) {
      const index = parseInt(item.dataset.index, 10);
      selectItem(index);
    }
  });

  /**
   * Update dropdown content
   */
  function updateDropdown() {
    dropdown.innerHTML = '';

    if (isLoading) {
      const loadingItem = createListItem(loadingText, 'loading');
      dropdown.appendChild(loadingItem);
      return;
    }

    if (hasError) {
      const errorItem = createListItem(errorText, 'error');
      dropdown.appendChild(errorItem);
      return;
    }

    if (results.length === 0 && currentQuery.length >= minChars) {
      const noResultsItem = createListItem(noResultsText, 'no-results');
      dropdown.appendChild(noResultsItem);
      return;
    }

    results.forEach((result, index) => {
      const item = createListItem(formatResult(result), 'result', index);
      dropdown.appendChild(item);
    });

    // Update selected item
    if (selectedIndex >= 0 && selectedIndex < results.length) {
      const items = dropdown.querySelectorAll('.autocomplete-item');
      items[selectedIndex]?.classList.add('selected');
      input.setAttribute('aria-activedescendant', items[selectedIndex]?.id || '');
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  /**
   * Create list item element
   */
  function createListItem(text, type, index = null) {
    const item = document.createElement('li');
    item.className = `autocomplete-item autocomplete-item--${type}`;
    item.textContent = text;
    item.setAttribute('role', 'option');

    if (type === 'result' && index !== null) {
      item.id = `autocomplete-option-${index}`;
      item.setAttribute('aria-selected', 'false');
      item.dataset.index = index;

      item.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Prevent input blur
        selectItem(index);
      });

      item.addEventListener('mouseenter', () => {
        selectedIndex = index;
        updateDropdown();
      });
    }

    return item;
  }

  /**
   * Open dropdown
   */
  function open() {
    if (isOpen) return;

    isOpen = true;
    dropdown.style.display = 'block';
    input.setAttribute('aria-expanded', 'true');
    updateDropdown();
  }

  /**
   * Close dropdown
   */
  function close() {
    if (!isOpen) return;

    isOpen = false;
    dropdown.style.display = 'none';
    input.setAttribute('aria-expanded', 'false');
    selectedIndex = -1;
    results = [];
  }

  /**
   * Perform search
   */
  async function search(query) {
    currentQuery = query;

    if (query.length < minChars) {
      close();
      return;
    }

    isLoading = true;
    hasError = false;
    open();
    updateDropdown();

    // Announce loading state to screen readers
    liveRegion.textContent = loadingText;

    try {
      results = await onSearch(query);
      isLoading = false;
      selectedIndex = -1;

      // Announce results to screen readers
      if (results.length === 0) {
        liveRegion.textContent = noResultsText;
      } else {
        liveRegion.textContent = `${results.length} result${results.length === 1 ? '' : 's'} found`;
      }

      updateDropdown();
    } catch (error) {
      console.error('Autocomplete search error:', error);
      isLoading = false;
      hasError = true;
      results = [];

      // Announce error to screen readers
      liveRegion.textContent = errorText;

      updateDropdown();
    }
  }

  /**
   * Debounced search
   */
  function debouncedSearch(query) {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      search(query);
    }, debounceMs);
  }

  /**
   * Select item at index
   */
  function selectItem(index) {
    if (index < 0 || index >= results.length) return;

    const item = results[index];
    const value = getItemValue(item);

    input.value = value;
    close();
    onSelect(item);

    // Announce selection to screen readers
    liveRegion.textContent = `Selected: ${value}`;
  }

  /**
   * Handle keyboard navigation
   */
  function handleKeyDown(e) {
    if (!isOpen || isLoading || hasError) {
      if (e.key === 'ArrowDown' && currentQuery.length >= minChars) {
        open();
        return;
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, results.length - 1);
        updateDropdown();
        break;

      case 'ArrowUp':
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, -1);
        updateDropdown();
        break;

      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          selectItem(selectedIndex);
        }
        break;

      case 'Escape':
        e.preventDefault();
        close();
        break;

      case 'Tab':
        close();
        break;
    }
  }

  // Event listeners
  input.addEventListener('input', (e) => {
    debouncedSearch(e.target.value);
  });

  input.addEventListener('keydown', handleKeyDown);

  input.addEventListener('blur', () => {
    // Delay close to allow click events to fire
    setTimeout(() => {
      close();
    }, 200);
  });

  input.addEventListener('focus', () => {
    if (currentQuery.length >= minChars && results.length > 0) {
      open();
    }
  });

  // Public API
  return {
    /**
     * Get input value
     */
    getValue() {
      return input.value;
    },

    /**
     * Set input value
     */
    setValue(value) {
      input.value = value;
      currentQuery = value;
    },

    /**
     * Clear input and close dropdown
     */
    clear() {
      input.value = '';
      currentQuery = '';
      close();
    },

    /**
     * Focus input
     */
    focus() {
      input.focus();
    },

    /**
     * Disable autocomplete
     */
    disable() {
      input.disabled = true;
      close();
    },

    /**
     * Enable autocomplete
     */
    enable() {
      input.disabled = false;
    },

    /**
     * Destroy autocomplete
     */
    destroy() {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      container.removeChild(inputWrapper);
    },

    /**
     * Get input element for external styling/attributes
     */
    getInput() {
      return input;
    },
  };
}
