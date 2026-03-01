// T075: SortableJS integration for drag-and-drop reordering
// T297: Keyboard navigation support for accessibility
import Sortable from 'sortablejs';
import { t } from '../utils/i18n.js';
import { escapeHtml } from '../utils/html.js';
import { logError } from '../utils/error-tracking.js';

// Track keyboard drag state
let keyboardDragState = {
  isActive: false,
  sourceCard: null,
  sourceZone: null,
  sourceIndex: null,
};

/**
 * Initialize drag-and-drop for timeline activities
 * @param {HTMLElement} timelineContainer - Timeline container element
 * @param {Function} onReorder - Callback when activities are reordered
 * @param {Function} onDateChange - Callback when activity moves to different day
 * @returns {Object} Object with sortable instances and cleanup function
 */
export function initializeDragDrop(timelineContainer, onReorder, onDateChange) {
  const sortableInstances = [];

  // Initialize keyboard navigation
  initializeKeyboardNavigation(timelineContainer, onReorder, onDateChange);

  // Find all drop zones (day groups)
  const dropZones = timelineContainer.querySelectorAll('[data-drop-zone]');

  dropZones.forEach((dropZone) => {
    const sortable = Sortable.create(dropZone, {
      group: 'activities', // Allow dragging between days
      animation: 150,
      handle: '.activity-drag-handle', // Only drag handle is draggable
      draggable: '.timeline-item', // Both activity and reservation cards
      ghostClass: 'activity-ghost', // Class for ghost element
      dragClass: 'activity-dragging', // Class while dragging
      chosenClass: 'activity-chosen', // Class when element is chosen
      forceFallback: true, // Use HTML5 DnD fallback for better cross-browser support
      fallbackClass: 'activity-fallback',
      fallbackOnBody: true,
      swapThreshold: 0.65,

      /**
       * Called when dragging starts
       */
      onStart: function (evt) {
        document.body.classList.add('is-dragging');
      },

      /**
       * Called when dragging ends
       */
      onEnd: async function (evt) {
        document.body.classList.remove('is-dragging');

        // Check if order changed or item moved between lists
        if (evt.oldIndex !== evt.newIndex || evt.from !== evt.to) {
          await handleReorder(evt, onReorder, onDateChange);
        }
      },
    });

    sortableInstances.push(sortable);
  });

  return sortableInstances;
}

/**
 * Handle activity reorder
 * @param {Object} evt - Sortable event object
 * @param {Function} onReorder - Reorder callback
 * @param {Function} onDateChange - Date change callback
 */
async function handleReorder(evt, onReorder, onDateChange) {
  try {
    const movedItem = evt.item;
    const itemType = movedItem.getAttribute('data-item-type');
    const itemId = movedItem.getAttribute('data-activity-id') || movedItem.getAttribute('data-id');
    const fromZone = evt.from;
    const toZone = evt.to;
    const fromDate = fromZone.getAttribute('data-drop-zone');
    const toDate = toZone.getAttribute('data-drop-zone');

    // Check if item moved to a different day
    const dateChanged = fromDate !== toDate && toDate !== 'zzz-undated';

    // If date changed, update the item's date first (only for activities, not multi-day reservations)
    if (dateChanged && onDateChange && itemId && itemType === 'activity') {
      await onDateChange(itemId, toDate);
    }

    // Get all timeline items in the new order
    const allItems = [];
    const dropZones = document.querySelectorAll('[data-drop-zone]');

    dropZones.forEach((zone) => {
      const cards = zone.querySelectorAll('.timeline-item');
      cards.forEach((card) => {
        const cardItemType = card.getAttribute('data-item-type');
        const cardId = card.getAttribute('data-activity-id') || card.getAttribute('data-id');
        if (cardId) {
          allItems.push({
            id: cardId,
            itemType: cardItemType,
            orderIndex: allItems.length, // Global order index
          });
        }
      });
    });

    // Call reorder callback with new order
    if (onReorder && allItems.length > 0) {
      await onReorder(allItems);
    }
  } catch (error) {
    logError('Failed to reorder items:', error);

    // Show error message
    showToast(t('dragDrop.reorderFailed'), 'error');

    // Optionally revert the order (would need to store original order)
  }
}

/**
 * Destroy all sortable instances
 * @param {Array} instances - Array of Sortable instances
 */
export function destroyDragDrop(instances) {
  instances.forEach((instance) => {
    if (instance && typeof instance.destroy === 'function') {
      instance.destroy();
    }
  });
}

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - Toast type (success, error, warning, info)
 */
function showToast(message, type = 'info') {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <span class="toast-message">${escapeHtml(message)}</span>
      <button class="toast-close" aria-label="${t('common.close')}">&times;</button>
    </div>
  `;

  toastContainer.appendChild(toast);

  // Handle close button
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => {
    removeToast(toast);
  });

  // Auto-remove after 5 seconds
  setTimeout(() => {
    removeToast(toast);
  }, 5000);
}

/**
 * Remove toast with animation
 * @param {HTMLElement} toast - Toast element
 */
function removeToast(toast) {
  toast.style.opacity = '0';
  toast.style.transform = 'translateX(100%)';

  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 300);
}

/**
 * Initialize keyboard navigation for drag-and-drop
 * @param {HTMLElement} container - Container element
 * @param {Function} onReorder - Reorder callback
 * @param {Function} onDateChange - Date change callback
 */
function initializeKeyboardNavigation(container, onReorder, onDateChange) {
  // Make timeline items focusable
  const cards = container.querySelectorAll('.timeline-item');
  cards.forEach((card, index) => {
    if (!card.hasAttribute('tabindex')) {
      card.setAttribute('tabindex', '0');
    }
    card.setAttribute('role', 'listitem');
    card.setAttribute('aria-grabbed', 'false');

    // Add keyboard hint
    const handle = card.querySelector('.activity-drag-handle');
    if (handle) {
      handle.setAttribute('aria-label', t('dragDrop.keyboardHint'));
    }
  });

  // Add role to drop zones
  const dropZones = container.querySelectorAll('[data-drop-zone]');
  dropZones.forEach((zone) => {
    zone.setAttribute('role', 'list');
    zone.setAttribute('aria-label', t('dragDrop.activitiesFor', { date: zone.dataset.dropZone || t('dragDrop.unscheduled') }));
  });

  // Handle keyboard events
  container.addEventListener('keydown', (e) => handleKeyboardNavigation(e, container, onReorder, onDateChange));
}

/**
 * Handle keyboard navigation events
 * @param {KeyboardEvent} e - Keyboard event
 * @param {HTMLElement} container - Container element
 * @param {Function} onReorder - Reorder callback
 * @param {Function} onDateChange - Date change callback
 */
async function handleKeyboardNavigation(e, container, onReorder, onDateChange) {
  const card = e.target.closest('.timeline-item');
  if (!card) return;

  switch (e.key) {
    case ' ':
    case 'Enter':
      e.preventDefault();
      toggleKeyboardDrag(card, container, onReorder, onDateChange);
      break;

    case 'ArrowUp':
      e.preventDefault();
      if (keyboardDragState.isActive) {
        await moveCardUp(container, onReorder, onDateChange);
      } else {
        focusPreviousCard(card, container);
      }
      break;

    case 'ArrowDown':
      e.preventDefault();
      if (keyboardDragState.isActive) {
        await moveCardDown(container, onReorder, onDateChange);
      } else {
        focusNextCard(card, container);
      }
      break;

    case 'Escape':
      if (keyboardDragState.isActive) {
        e.preventDefault();
        cancelKeyboardDrag(container);
      }
      break;
  }
}

/**
 * Toggle keyboard drag mode
 * @param {HTMLElement} card - Activity card
 * @param {HTMLElement} container - Container element
 * @param {Function} onReorder - Reorder callback
 * @param {Function} onDateChange - Date change callback
 */
async function toggleKeyboardDrag(card, container, onReorder, onDateChange) {
  if (keyboardDragState.isActive) {
    // Drop the card
    await dropCard(container, onReorder, onDateChange);
  } else {
    // Pick up the card
    pickUpCard(card, container);
  }
}

/**
 * Pick up a card for keyboard dragging
 * @param {HTMLElement} card - Card to pick up
 * @param {HTMLElement} container - Container element
 */
function pickUpCard(card, container) {
  const zone = card.closest('[data-drop-zone]');
  const cards = Array.from(zone.querySelectorAll('.timeline-item'));

  keyboardDragState = {
    isActive: true,
    sourceCard: card,
    sourceZone: zone,
    sourceIndex: cards.indexOf(card),
  };

  card.classList.add('keyboard-dragging');
  card.setAttribute('aria-grabbed', 'true');
  container.classList.add('keyboard-drag-active');

  announceForScreenReader(t('dragDrop.activityPickedUp'));
}

/**
 * Drop the currently dragged card
 * @param {HTMLElement} container - Container element
 * @param {Function} onReorder - Reorder callback
 * @param {Function} onDateChange - Date change callback
 */
async function dropCard(container, onReorder, onDateChange) {
  const { sourceCard, sourceZone, sourceIndex } = keyboardDragState;

  if (!sourceCard) return;

  const currentZone = sourceCard.closest('[data-drop-zone]');
  const cards = Array.from(currentZone.querySelectorAll('.timeline-item'));
  const currentIndex = cards.indexOf(sourceCard);

  // Check if moved to a different day
  const fromDate = sourceZone.dataset.dropZone;
  const toDate = currentZone.dataset.dropZone;
  const dateChanged = fromDate !== toDate && toDate !== 'zzz-undated';

  // Update date if needed (only for activities, not multi-day reservations)
  const itemType = sourceCard.dataset.itemType;
  if (dateChanged && onDateChange && itemType === 'activity') {
    const activityId = sourceCard.dataset.activityId;
    await onDateChange(activityId, toDate);
  }

  // Trigger reorder
  if (onReorder) {
    const allActivities = getAllActivitiesInOrder(container);
    await onReorder(allActivities);
  }

  // Clear drag state
  sourceCard.classList.remove('keyboard-dragging');
  sourceCard.setAttribute('aria-grabbed', 'false');
  container.classList.remove('keyboard-drag-active');

  keyboardDragState = {
    isActive: false,
    sourceCard: null,
    sourceZone: null,
    sourceIndex: null,
  };

  announceForScreenReader(t('dragDrop.activityDropped'));
}

/**
 * Cancel keyboard drag operation
 * @param {HTMLElement} container - Container element
 */
function cancelKeyboardDrag(container) {
  const { sourceCard, sourceZone, sourceIndex } = keyboardDragState;

  if (!sourceCard) return;

  // Move card back to original position
  const currentZone = sourceCard.closest('[data-drop-zone]');
  if (currentZone !== sourceZone) {
    const cards = Array.from(sourceZone.querySelectorAll('.timeline-item'));
    if (sourceIndex >= cards.length) {
      sourceZone.appendChild(sourceCard);
    } else {
      sourceZone.insertBefore(sourceCard, cards[sourceIndex]);
    }
  }

  // Clear drag state
  sourceCard.classList.remove('keyboard-dragging');
  sourceCard.setAttribute('aria-grabbed', 'false');
  container.classList.remove('keyboard-drag-active');
  sourceCard.focus();

  keyboardDragState = {
    isActive: false,
    sourceCard: null,
    sourceZone: null,
    sourceIndex: null,
  };

  announceForScreenReader(t('dragDrop.dragCancelled'));
}

/**
 * Move card up in the list
 * @param {HTMLElement} container - Container element
 * @param {Function} onReorder - Reorder callback
 * @param {Function} onDateChange - Date change callback
 */
async function moveCardUp(container, onReorder, onDateChange) {
  const { sourceCard } = keyboardDragState;
  if (!sourceCard) return;

  const zone = sourceCard.closest('[data-drop-zone]');
  const prevSibling = sourceCard.previousElementSibling;

  if (prevSibling && prevSibling.classList.contains('timeline-item')) {
    // Move within same zone
    zone.insertBefore(sourceCard, prevSibling);
    sourceCard.focus();
    announceForScreenReader(t('dragDrop.movedUp'));
  } else {
    // Try to move to previous zone
    const dropZones = Array.from(container.querySelectorAll('[data-drop-zone]'));
    const zoneIndex = dropZones.indexOf(zone);

    if (zoneIndex > 0) {
      const prevZone = dropZones[zoneIndex - 1];
      prevZone.appendChild(sourceCard);
      sourceCard.focus();
      announceForScreenReader(t('dragDrop.movedToDay', { day: prevZone.dataset.dropZone || t('dragDrop.previousDay') }));
    }
  }
}

/**
 * Move card down in the list
 * @param {HTMLElement} container - Container element
 * @param {Function} onReorder - Reorder callback
 * @param {Function} onDateChange - Date change callback
 */
async function moveCardDown(container, onReorder, onDateChange) {
  const { sourceCard } = keyboardDragState;
  if (!sourceCard) return;

  const zone = sourceCard.closest('[data-drop-zone]');
  const nextSibling = sourceCard.nextElementSibling;

  if (nextSibling && nextSibling.classList.contains('timeline-item')) {
    // Move within same zone
    zone.insertBefore(nextSibling, sourceCard);
    sourceCard.focus();
    announceForScreenReader(t('dragDrop.movedDown'));
  } else {
    // Try to move to next zone
    const dropZones = Array.from(container.querySelectorAll('[data-drop-zone]'));
    const zoneIndex = dropZones.indexOf(zone);

    if (zoneIndex < dropZones.length - 1) {
      const nextZone = dropZones[zoneIndex + 1];
      const firstCard = nextZone.querySelector('.timeline-item');
      if (firstCard) {
        nextZone.insertBefore(sourceCard, firstCard);
      } else {
        nextZone.appendChild(sourceCard);
      }
      sourceCard.focus();
      announceForScreenReader(t('dragDrop.movedToDay', { day: nextZone.dataset.dropZone || t('dragDrop.nextDay') }));
    }
  }
}

/**
 * Focus previous activity card
 * @param {HTMLElement} currentCard - Current card
 * @param {HTMLElement} container - Container element
 */
function focusPreviousCard(currentCard, container) {
  const allCards = Array.from(container.querySelectorAll('.timeline-item'));
  const currentIndex = allCards.indexOf(currentCard);

  if (currentIndex > 0) {
    allCards[currentIndex - 1].focus();
  }
}

/**
 * Focus next timeline item
 * @param {HTMLElement} currentCard - Current card
 * @param {HTMLElement} container - Container element
 */
function focusNextCard(currentCard, container) {
  const allCards = Array.from(container.querySelectorAll('.timeline-item'));
  const currentIndex = allCards.indexOf(currentCard);

  if (currentIndex < allCards.length - 1) {
    allCards[currentIndex + 1].focus();
  }
}

/**
 * Get all timeline items in current order
 * @param {HTMLElement} container - Container element
 * @returns {Array} Array of item objects with id, itemType, and orderIndex
 */
function getAllActivitiesInOrder(container) {
  const allItems = [];
  const dropZones = container.querySelectorAll('[data-drop-zone]');

  dropZones.forEach((zone) => {
    const cards = zone.querySelectorAll('.timeline-item');
    cards.forEach((card) => {
      const itemId = card.dataset.activityId || card.dataset.id;
      const itemType = card.dataset.itemType;
      if (itemId) {
        allItems.push({
          id: itemId,
          itemType: itemType,
          orderIndex: allItems.length,
        });
      }
    });
  });

  return allItems;
}

/**
 * Announce message for screen readers
 * @param {string} message - Message to announce
 */
function announceForScreenReader(message) {
  let announcer = document.getElementById('sr-announcer');

  if (!announcer) {
    announcer = document.createElement('div');
    announcer.id = 'sr-announcer';
    announcer.setAttribute('aria-live', 'assertive');
    announcer.setAttribute('aria-atomic', 'true');
    announcer.className = 'sr-only';
    document.body.appendChild(announcer);
  }

  // Clear and set message (triggers announcement)
  announcer.textContent = '';
  setTimeout(() => {
    announcer.textContent = message;
  }, 50);
}

/**
 * Add CSS for drag-and-drop states
 * This should be called once during initialization
 */
export function addDragDropStyles() {
  const style = document.createElement('style');
  style.textContent = `
    /* Drag and drop styles */
    .is-dragging .timeline-item:not(.activity-dragging) {
      opacity: 0.6;
    }

    .activity-ghost {
      opacity: 0.4;
      background: var(--color-primary-light);
    }

    .activity-dragging {
      opacity: 0.8;
      cursor: grabbing !important;
      box-shadow: var(--shadow-lg);
      transform: rotate(2deg);
    }

    .activity-chosen {
      cursor: grabbing;
    }

    .activity-fallback {
      opacity: 0.8;
    }

    .timeline-item {
      cursor: grab;
      transition: transform var(--transition-fast), box-shadow var(--transition-fast);
    }

    .timeline-item:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
    }

    .timeline-item:focus {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }

    /* Keyboard drag styles */
    .timeline-item.keyboard-dragging {
      outline: 3px solid var(--color-primary);
      outline-offset: 2px;
      box-shadow: var(--shadow-lg);
      background: var(--color-primary-light);
    }

    .keyboard-drag-active .timeline-item:not(.keyboard-dragging) {
      opacity: 0.6;
    }

    [data-drop-zone] {
      min-height: 60px;
      transition: background-color var(--transition-fast);
    }

    [data-drop-zone]:empty::before {
      content: 'Drop activities here';
      display: block;
      text-align: center;
      padding: var(--spacing-4);
      color: var(--color-gray-400);
      font-style: italic;
    }

    [data-drop-zone].sortable-drag-over {
      background-color: var(--color-gray-100);
      border: 2px dashed var(--color-primary);
      border-radius: var(--radius-md);
    }

    /* Screen reader only class */
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  `;

  document.head.appendChild(style);
}
