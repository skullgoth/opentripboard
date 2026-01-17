// Icon picker component for selecting emoji icons

import { ICON_PICKER_EMOJIS } from '../utils/default-categories.js';
import { t } from '../utils/i18n.js';

/**
 * Create an icon picker component
 * @param {Object} options - Configuration options
 * @param {HTMLElement} options.container - Container element
 * @param {Function} options.onSelect - Selection callback: (icon) => void
 * @param {string} options.selectedIcon - Currently selected icon
 * @param {string} options.label - Label text (optional)
 * @returns {Object} - Icon picker API
 */
export function createIconPicker(options) {
  const {
    container,
    onSelect,
    selectedIcon = '',
    label = '',
  } = options;

  // State
  let currentIcon = selectedIcon;
  let isOpen = false;
  let focusedIndex = -1;

  // Get emoji list
  const emojis = ICON_PICKER_EMOJIS;

  // Create elements
  const wrapper = document.createElement('div');
  wrapper.className = 'icon-picker';

  // Label if provided
  if (label) {
    const labelEl = document.createElement('label');
    labelEl.className = 'icon-picker-label';
    labelEl.textContent = label;
    wrapper.appendChild(labelEl);
  }

  // Trigger button
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'icon-picker-trigger';
  trigger.setAttribute('aria-haspopup', 'grid');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-label', t('settings.tripCategories.selectIcon') || 'Select an icon');

  const triggerIcon = document.createElement('span');
  triggerIcon.className = 'icon-picker-trigger-icon';
  triggerIcon.textContent = currentIcon || '➕';

  const triggerText = document.createElement('span');
  triggerText.className = 'icon-picker-trigger-text';
  triggerText.textContent = currentIcon
    ? ''
    : (t('settings.tripCategories.selectIcon') || 'Select icon');

  trigger.appendChild(triggerIcon);
  trigger.appendChild(triggerText);
  wrapper.appendChild(trigger);

  // Dropdown grid
  const dropdown = document.createElement('div');
  dropdown.className = 'icon-picker-dropdown';
  dropdown.setAttribute('role', 'grid');
  dropdown.setAttribute('aria-label', t('settings.tripCategories.selectIcon') || 'Select an icon');
  dropdown.style.display = 'none';

  // Create emoji grid
  const grid = document.createElement('div');
  grid.className = 'icon-picker-grid';
  grid.setAttribute('role', 'row');

  emojis.forEach((emoji, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'icon-picker-item';
    if (emoji === currentIcon) {
      button.classList.add('selected');
    }
    button.setAttribute('role', 'gridcell');
    button.setAttribute('data-emoji', emoji);
    button.setAttribute('data-index', index.toString());
    button.setAttribute('aria-label', emoji);
    button.textContent = emoji;
    grid.appendChild(button);
  });

  dropdown.appendChild(grid);
  wrapper.appendChild(dropdown);

  // Live region for accessibility
  const liveRegion = document.createElement('div');
  liveRegion.className = 'sr-only';
  liveRegion.setAttribute('role', 'status');
  liveRegion.setAttribute('aria-live', 'polite');
  wrapper.appendChild(liveRegion);

  container.appendChild(wrapper);

  /**
   * Open the dropdown
   */
  function open() {
    if (isOpen) return;
    isOpen = true;
    dropdown.style.display = 'block';
    trigger.setAttribute('aria-expanded', 'true');
    wrapper.classList.add('open');

    // Focus first item or selected item
    const selectedIndex = currentIcon ? emojis.indexOf(currentIcon) : 0;
    focusedIndex = selectedIndex >= 0 ? selectedIndex : 0;
    focusItem(focusedIndex);

    // Add click outside listener
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);
  }

  /**
   * Close the dropdown
   */
  function close() {
    if (!isOpen) return;
    isOpen = false;
    dropdown.style.display = 'none';
    trigger.setAttribute('aria-expanded', 'false');
    wrapper.classList.remove('open');
    focusedIndex = -1;
    document.removeEventListener('click', handleClickOutside);
  }

  /**
   * Toggle the dropdown
   */
  function toggle() {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }

  /**
   * Focus an item by index
   * @param {number} index - Item index
   */
  function focusItem(index) {
    const items = grid.querySelectorAll('.icon-picker-item');
    items.forEach((item, i) => {
      item.classList.toggle('focused', i === index);
      if (i === index) {
        item.focus();
      }
    });
  }

  /**
   * Select an icon
   * @param {string} icon - Selected emoji
   */
  function selectIcon(icon) {
    currentIcon = icon;
    triggerIcon.textContent = icon;
    triggerText.textContent = '';

    // Update selected state
    const items = grid.querySelectorAll('.icon-picker-item');
    items.forEach((item) => {
      item.classList.toggle('selected', item.dataset.emoji === icon);
    });

    // Announce selection
    liveRegion.textContent = `Selected ${icon}`;

    close();

    if (onSelect) {
      onSelect(icon);
    }
  }

  /**
   * Handle click outside dropdown
   * @param {Event} event - Click event
   */
  function handleClickOutside(event) {
    if (!wrapper.contains(event.target)) {
      close();
    }
  }

  /**
   * Handle keyboard navigation
   * @param {KeyboardEvent} event - Keyboard event
   */
  function handleKeydown(event) {
    if (!isOpen) {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
        event.preventDefault();
        open();
      }
      return;
    }

    const itemsPerRow = 8; // Adjust based on CSS grid
    const totalItems = emojis.length;

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        close();
        trigger.focus();
        break;

      case 'ArrowRight':
        event.preventDefault();
        focusedIndex = (focusedIndex + 1) % totalItems;
        focusItem(focusedIndex);
        break;

      case 'ArrowLeft':
        event.preventDefault();
        focusedIndex = (focusedIndex - 1 + totalItems) % totalItems;
        focusItem(focusedIndex);
        break;

      case 'ArrowDown':
        event.preventDefault();
        focusedIndex = Math.min(focusedIndex + itemsPerRow, totalItems - 1);
        focusItem(focusedIndex);
        break;

      case 'ArrowUp':
        event.preventDefault();
        focusedIndex = Math.max(focusedIndex - itemsPerRow, 0);
        focusItem(focusedIndex);
        break;

      case 'Home':
        event.preventDefault();
        focusedIndex = 0;
        focusItem(focusedIndex);
        break;

      case 'End':
        event.preventDefault();
        focusedIndex = totalItems - 1;
        focusItem(focusedIndex);
        break;

      case 'Enter':
      case ' ':
        event.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < totalItems) {
          selectIcon(emojis[focusedIndex]);
        }
        break;
    }
  }

  // Event listeners
  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggle();
  });

  trigger.addEventListener('keydown', handleKeydown);

  grid.addEventListener('click', (e) => {
    const item = e.target.closest('.icon-picker-item');
    if (item) {
      selectIcon(item.dataset.emoji);
    }
  });

  grid.addEventListener('keydown', handleKeydown);

  // API
  return {
    /**
     * Get the currently selected icon
     * @returns {string} Selected icon
     */
    getValue() {
      return currentIcon;
    },

    /**
     * Set the selected icon
     * @param {string} icon - Icon to select
     */
    setValue(icon) {
      currentIcon = icon;
      triggerIcon.textContent = icon || '➕';
      triggerText.textContent = icon ? '' : (t('settings.tripCategories.selectIcon') || 'Select icon');

      // Update selected state
      const items = grid.querySelectorAll('.icon-picker-item');
      items.forEach((item) => {
        item.classList.toggle('selected', item.dataset.emoji === icon);
      });
    },

    /**
     * Open the picker
     */
    open,

    /**
     * Close the picker
     */
    close,

    /**
     * Check if picker is open
     * @returns {boolean} True if open
     */
    isOpen() {
      return isOpen;
    },

    /**
     * Destroy the component
     */
    destroy() {
      document.removeEventListener('click', handleClickOutside);
      wrapper.remove();
    },

    /**
     * Get the DOM element
     * @returns {HTMLElement} Wrapper element
     */
    getElement() {
      return wrapper;
    },
  };
}

export default createIconPicker;
