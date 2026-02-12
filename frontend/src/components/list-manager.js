/**
 * T228: ListManager component - displays all lists with tabs and actions
 */
import { t } from '../utils/i18n.js';
import { escapeHtml } from '../utils/html.js';

/**
 * Create list manager component
 * @param {Array} lists - Array of list objects
 * @param {Object} options - Display options
 * @returns {string} HTML string
 */
export function createListManager(lists = [], options = {}) {
  const { activeType = 'all', showCreateButton = true } = options;

  // Group lists by type
  const listsByType = {
    packing: lists.filter(l => l.type === 'packing'),
    todo: lists.filter(l => l.type === 'todo'),
    shopping: lists.filter(l => l.type === 'shopping'),
    custom: lists.filter(l => l.type === 'custom'),
  };

  const filteredLists = activeType === 'all' ? lists : listsByType[activeType] || [];

  return `
    <div class="list-manager">
      <div class="list-manager-header">
        <h3>${t('lists.title')}</h3>
        ${showCreateButton ? `
          <button class="btn btn-primary btn-sm" data-action="create-list">
            + ${t('lists.newList')}
          </button>
        ` : ''}
      </div>

      <div class="list-type-tabs">
        <button class="tab-btn ${activeType === 'all' ? 'active' : ''}" data-action="filter-lists" data-type="all">
          ${t('lists.all')} (${lists.length})
        </button>
        <button class="tab-btn ${activeType === 'packing' ? 'active' : ''}" data-action="filter-lists" data-type="packing">
          ${t('lists.types.packing')} (${listsByType.packing.length})
        </button>
        <button class="tab-btn ${activeType === 'todo' ? 'active' : ''}" data-action="filter-lists" data-type="todo">
          ${t('lists.types.todo')} (${listsByType.todo.length})
        </button>
        <button class="tab-btn ${activeType === 'shopping' ? 'active' : ''}" data-action="filter-lists" data-type="shopping">
          ${t('lists.types.shopping')} (${listsByType.shopping.length})
        </button>
        <button class="tab-btn ${activeType === 'custom' ? 'active' : ''}" data-action="filter-lists" data-type="custom">
          ${t('lists.types.custom')} (${listsByType.custom.length})
        </button>
      </div>

      <div class="lists-container" id="lists-container">
        ${filteredLists.length > 0
          ? filteredLists.map(list => createListCard(list)).join('')
          : createEmptyState(activeType)
        }
      </div>
    </div>
  `;
}

/**
 * Create list card component
 * @param {Object} list - List object
 * @returns {string} HTML string
 */
export function createListCard(list) {
  const items = list.items || [];
  const totalItems = items.length;
  const checkedItems = items.filter(item => item.checked).length;
  const progress = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;

  const typeIcon = getListTypeIcon(list.type);
  const typeLabel = formatListType(list.type);

  return `
    <div class="list-card" data-list-id="${list.id}">
      <div class="list-card-header">
        <div class="list-card-title">
          <span class="list-type-icon">${typeIcon}</span>
          <h4>${escapeHtml(list.title)}</h4>
        </div>
        <div class="list-card-actions">
          <button class="btn btn-icon btn-sm" data-action="edit-list" data-list-id="${list.id}" title="${t('common.edit')}">
            ✏️
          </button>
          <button class="btn btn-icon btn-sm btn-danger" data-action="delete-list" data-list-id="${list.id}" title="${t('common.delete')}">
            🗑️
          </button>
        </div>
      </div>

      <div class="list-card-meta">
        <span class="list-type-badge type-${list.type}">${typeLabel}</span>
        <span class="list-item-count">${t('lists.itemsCount', { checked: checkedItems, total: totalItems })}</span>
      </div>

      ${totalItems > 0 ? `
        <div class="list-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progress}%"></div>
          </div>
          <span class="progress-text">${t('lists.percentComplete', { percent: progress })}</span>
        </div>
      ` : ''}

      <div class="list-card-preview">
        ${items.slice(0, 3).map(item => `
          <div class="preview-item ${item.checked ? 'checked' : ''}">
            <span class="preview-checkbox">${item.checked ? '☑' : '☐'}</span>
            <span class="preview-text">${escapeHtml(item.text)}</span>
          </div>
        `).join('')}
        ${totalItems > 3 ? `
          <div class="preview-more">${t('lists.moreItems', { count: totalItems - 3 })}</div>
        ` : ''}
      </div>

      <button class="btn btn-secondary btn-sm list-card-open" data-action="open-list" data-list-id="${list.id}">
        ${t('lists.openList')}
      </button>
    </div>
  `;
}

/**
 * Create empty state for lists
 * @param {string} type - List type filter
 * @returns {string} HTML string
 */
function createEmptyState(type) {
  const messageKeys = {
    all: 'lists.noLists',
    packing: 'lists.noPackingLists',
    todo: 'lists.noTodoLists',
    shopping: 'lists.noShoppingLists',
    custom: 'lists.noCustomLists',
  };

  return `
    <div class="empty-state">
      <p>${t(messageKeys[type] || messageKeys.all)}</p>
      <p class="text-muted">${t('lists.createOrTemplate')}</p>
      <div class="empty-state-actions">
        <button class="btn btn-primary" data-action="create-list">
          ${t('lists.createNewList')}
        </button>
        <button class="btn btn-secondary" data-action="show-templates">
          ${t('lists.useTemplate')}
        </button>
      </div>
    </div>
  `;
}

/**
 * Get list type icon
 * @param {string} type - List type
 * @returns {string} Icon emoji
 */
export function getListTypeIcon(type) {
  const icons = {
    packing: '🎒',
    todo: '✅',
    shopping: '🛒',
    custom: '📝',
  };
  return icons[type] || '📝';
}

/**
 * Format list type for display
 * @param {string} type - List type
 * @returns {string} Formatted type name
 */
export function formatListType(type) {
  const typeKey = `lists.types.${type}`;
  return t(typeKey) || type;
}

