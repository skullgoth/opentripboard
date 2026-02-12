/**
 * T228: PackingList component - displays a single list with checkable items
 */
import { getListTypeIcon, formatListType } from './list-manager.js';
import { t } from '../utils/i18n.js';
import { escapeHtml } from '../utils/html.js';

/**
 * Create packing list component
 * @param {Object} list - List object with items
 * @param {Object} options - Display options
 * @returns {string} HTML string
 */
export function createPackingList(list, options = {}) {
  const { showHeader = true, showAddItem = true, showProgress = true, sortable = true } = options;

  if (!list) {
    return `<div class="empty-state"><p>${t('lists.listNotFound')}</p></div>`;
  }

  const items = list.items || [];
  const totalItems = items.length;
  const checkedItems = items.filter(item => item.checked).length;
  const progress = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;

  // Sort items by order
  const sortedItems = [...items].sort((a, b) => (a.order || 0) - (b.order || 0));

  return `
    <div class="packing-list" data-list-id="${list.id}">
      ${showHeader ? createListHeader(list) : ''}

      ${showProgress && totalItems > 0 ? createProgressSection(checkedItems, totalItems, progress) : ''}

      ${showAddItem ? createAddItemForm() : ''}

      <div class="list-items ${sortable ? 'sortable-list' : ''}" id="list-items-${list.id}">
        ${sortedItems.length > 0
          ? sortedItems.map(item => createListItem(item, list.id)).join('')
          : `<div class="empty-items">
              <p>${t('lists.noItems')}</p>
              <p class="text-muted">${t('lists.addItemsHint')}</p>
            </div>`
        }
      </div>

      <div class="list-actions">
        <button class="btn btn-secondary btn-sm" data-action="clear-checked" data-list-id="${list.id}">
          ${t('lists.clearChecked')}
        </button>
        <button class="btn btn-secondary btn-sm" data-action="uncheck-all" data-list-id="${list.id}">
          ${t('lists.uncheckAll')}
        </button>
        <button class="btn btn-secondary btn-sm" data-action="check-all" data-list-id="${list.id}">
          ${t('lists.checkAll')}
        </button>
      </div>
    </div>
  `;
}

/**
 * Create list header
 * @param {Object} list - List object
 * @returns {string} HTML string
 */
function createListHeader(list) {
  const typeIcon = getListTypeIcon(list.type);
  const typeLabel = formatListType(list.type);

  return `
    <div class="packing-list-header">
      <div class="list-header-info">
        <button class="btn btn-icon back-btn" data-action="back-to-lists" title="${t('lists.backToLists')}" aria-label="${t('lists.backToLists')}">
          ←
        </button>
        <span class="list-type-icon">${typeIcon}</span>
        <div class="list-header-title">
          <h3>${escapeHtml(list.title)}</h3>
          <span class="list-type-badge type-${list.type}">${typeLabel}</span>
        </div>
      </div>
      <div class="list-header-actions">
        <button class="btn btn-icon" data-action="edit-list-title" data-list-id="${list.id}" title="${t('lists.editTitle')}" aria-label="${t('lists.editTitle')}">
          ✏️
        </button>
        <button class="btn btn-icon btn-danger" data-action="delete-list" data-list-id="${list.id}" title="${t('lists.deleteList')}" aria-label="${t('lists.deleteList')}">
          🗑️
        </button>
      </div>
    </div>
  `;
}

/**
 * Create progress section
 * @param {number} checked - Checked count
 * @param {number} total - Total count
 * @param {number} progress - Progress percentage
 * @returns {string} HTML string
 */
function createProgressSection(checked, total, progress) {
  return `
    <div class="list-progress-section">
      <div class="progress-stats">
        <span class="progress-count">${t('lists.itemsCompleted', { checked, total })}</span>
        <span class="progress-percent">${progress}%</span>
      </div>
      <div class="progress-bar large">
        <div class="progress-fill ${progress === 100 ? 'complete' : ''}" style="width: ${progress}%"></div>
      </div>
    </div>
  `;
}

/**
 * Create add item form
 * @returns {string} HTML string
 */
function createAddItemForm() {
  return `
    <div class="add-item-form">
      <input
        type="text"
        class="add-item-input"
        id="new-item-text"
        placeholder="${t('lists.addNewItem')}"
        data-action="add-item-input"
      />
      <button class="btn btn-primary btn-sm" data-action="add-item">
        ${t('common.add')}
      </button>
    </div>
  `;
}

/**
 * Create single list item
 * @param {Object} item - Item object
 * @param {string} listId - Parent list ID
 * @returns {string} HTML string
 */
export function createListItem(item, listId) {
  return `
    <div class="list-item ${item.checked ? 'checked' : ''}" data-item-id="${item.id}" data-list-id="${listId}">
      <div class="list-item-drag-handle" title="${t('lists.dragToReorder')}">
        ⋮⋮
      </div>
      <label class="list-item-checkbox">
        <input
          type="checkbox"
          ${item.checked ? 'checked' : ''}
          data-action="toggle-item"
          data-item-id="${item.id}"
          data-list-id="${listId}"
        />
        <span class="checkmark"></span>
      </label>
      <span class="list-item-text ${item.checked ? 'strikethrough' : ''}">
        ${escapeHtml(item.text)}
      </span>
      <button
        class="btn btn-icon btn-sm btn-danger list-item-delete"
        data-action="delete-item"
        data-item-id="${item.id}"
        data-list-id="${listId}"
        title="${t('common.delete')}"
      >
        ×
      </button>
    </div>
  `;
}

/**
 * Create compact list view for sidebar or summary
 * @param {Object} list - List object
 * @returns {string} HTML string
 */
export function createCompactList(list) {
  const items = list.items || [];
  const totalItems = items.length;
  const checkedItems = items.filter(item => item.checked).length;
  const uncheckedItems = items.filter(item => !item.checked).slice(0, 5);

  return `
    <div class="compact-list" data-list-id="${list.id}">
      <div class="compact-list-header">
        <span class="list-type-icon">${getListTypeIcon(list.type)}</span>
        <span class="compact-list-title">${escapeHtml(list.title)}</span>
        <span class="compact-list-count">${checkedItems}/${totalItems}</span>
      </div>
      ${uncheckedItems.length > 0 ? `
        <ul class="compact-list-items">
          ${uncheckedItems.map(item => `
            <li class="compact-item">
              <span class="compact-checkbox">☐</span>
              ${escapeHtml(item.text)}
            </li>
          `).join('')}
        </ul>
      ` : `
        <p class="compact-list-done">${t('lists.allItemsCompleted')}</p>
      `}
    </div>
  `;
}
