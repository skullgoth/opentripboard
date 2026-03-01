// T228: Packing and Custom Lists page
import Sortable from 'sortablejs';
import { createListManager, createListCard } from '../components/list-manager.js';
import { createPackingList, createListItem } from '../components/packing-list.js';
import { createTemplateSelector, createListForm } from '../components/list-template-selector.js';
import { showToast } from '../utils/toast.js';
import { confirmDialog } from '../utils/confirm-dialog.js';
import { app } from '../main.js';
import { tripState } from '../state/trip-state.js';
import { authState } from '../state/auth-state.js';
import * as api from '../services/api-client.js';
import { t } from '../utils/i18n.js';
import { escapeHtml } from '../utils/html.js';
import { logError } from '../utils/error-tracking.js';

let currentTrip = null;
let currentLists = [];
let currentList = null;
let currentTemplates = [];
let currentFilter = 'all';
let sortableInstance = null;

/**
 * Render lists page
 * @param {Object} params - Route parameters
 */
export async function listsPage(params) {
  const container = document.getElementById('page-container');
  const { id: tripId } = params;

  // Check authentication
  if (!authState.isAuthenticated()) {
    app.router.navigate('/login');
    return;
  }

  // Show loading state
  container.innerHTML = `
    <div class="loading-page">
      <div class="spinner"></div>
      <p>${t('lists.loading')}</p>
    </div>
  `;

  try {
    // Load trip, lists, and templates
    const [trip, lists, templates] = await Promise.all([
      tripState.loadTrip(tripId),
      api.getLists(tripId),
      api.getListTemplates(),
    ]);

    currentTrip = trip;
    currentLists = lists;
    currentTemplates = templates;
    currentList = null;

    renderListManagerView(container);
    attachListManagerListeners(container, tripId);

  } catch (error) {
    logError('Failed to load lists:', error);
    container.innerHTML = `
      <div class="error-page">
        <h2>${t('lists.loadFailed')}</h2>
        <p>${error.message || t('errors.generic')}</p>
        <a href="#/trips/${tripId}" class="btn btn-sm btn-primary">${t('lists.backToTrip')}</a>
      </div>
    `;
  }
}

/**
 * Render list manager view (shows all lists)
 */
function renderListManagerView(container) {
  const listManagerHtml = createListManager(currentLists, {
    activeType: currentFilter,
    showCreateButton: true,
  });

  container.innerHTML = `
    <div class="lists-page">
      <div class="page-header">
        <div class="page-header-content">
          <a href="#/trips/${currentTrip.id}" class="btn btn-secondary btn-sm">
            ← ${t('lists.backToTrip')}
          </a>
          <h1>${t('lists.title')}</h1>
          <p class="page-subtitle">${escapeHtml(currentTrip.name)}</p>
        </div>
      </div>

      <div class="lists-page-content">
        ${listManagerHtml}
      </div>

      <!-- Create List Modal -->
      <div id="list-modal" class="modal-overlay">
        <div class="modal-dialog">
          <div id="list-form-container"></div>
        </div>
      </div>

      <!-- Template Selector Modal -->
      <div id="template-modal" class="modal-overlay">
        <div class="modal-dialog modal-lg">
          <div id="template-selector-container"></div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render single list view (for viewing/editing a specific list)
 */
function renderSingleListView(container) {
  if (!currentList) {
    renderListManagerView(container);
    return;
  }

  const packingListHtml = createPackingList(currentList, {
    showHeader: true,
    showAddItem: true,
    showProgress: true,
    sortable: true,
  });

  container.innerHTML = `
    <div class="lists-page">
      <div class="page-header">
        <div class="page-header-content">
          <a href="#/trips/${currentTrip.id}" class="btn btn-secondary btn-sm">
            ← ${t('lists.backToTrip')}
          </a>
          <h1>${t('lists.title')}</h1>
          <p class="page-subtitle">${escapeHtml(currentTrip.name)}</p>
        </div>
      </div>

      <div class="lists-page-content single-list-view">
        ${packingListHtml}
      </div>

      <!-- Edit List Modal -->
      <div id="list-modal" class="modal-overlay">
        <div class="modal-dialog">
          <div id="list-form-container"></div>
        </div>
      </div>
    </div>
  `;

  // Setup sortable for list items
  setupSortable();
}

/**
 * Attach event listeners for list manager view
 */
function attachListManagerListeners(container, tripId) {
  // Create list button
  container.querySelector('[data-action="create-list"]')?.addEventListener('click', () => {
    showTemplateSelector();
  });

  // Show templates button
  container.querySelector('[data-action="show-templates"]')?.addEventListener('click', () => {
    showTemplateSelector();
  });

  // Filter tabs
  container.querySelectorAll('[data-action="filter-lists"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      currentFilter = e.target.dataset.type;
      renderListManagerView(container);
      attachListManagerListeners(container, tripId);
    });
  });

  // List card actions (delegated)
  container.querySelector('.lists-container')?.addEventListener('click', (e) => {
    const openBtn = e.target.closest('[data-action="open-list"]');
    const editBtn = e.target.closest('[data-action="edit-list"]');
    const deleteBtn = e.target.closest('[data-action="delete-list"]');

    if (openBtn) {
      const listId = openBtn.dataset.listId;
      openList(listId, container);
    }

    if (editBtn) {
      const listId = editBtn.dataset.listId;
      const list = currentLists.find(l => l.id === listId);
      if (list) {
        showListForm(list);
      }
    }

    if (deleteBtn) {
      const listId = deleteBtn.dataset.listId;
      handleDeleteList(tripId, listId, container);
    }
  });
}

/**
 * Attach event listeners for single list view
 */
function attachSingleListListeners(container, tripId) {
  // Back to lists
  container.querySelector('[data-action="back-to-lists"]')?.addEventListener('click', () => {
    currentList = null;
    renderListManagerView(container);
    attachListManagerListeners(container, tripId);
  });

  // Edit list title
  container.querySelector('[data-action="edit-list-title"]')?.addEventListener('click', () => {
    showListForm(currentList);
  });

  // Delete list
  container.querySelector('[data-action="delete-list"]')?.addEventListener('click', () => {
    handleDeleteList(tripId, currentList.id, container);
  });

  // Add item
  const addItemBtn = container.querySelector('[data-action="add-item"]');
  const addItemInput = container.querySelector('#new-item-text');

  if (addItemBtn && addItemInput) {
    const addItem = async () => {
      const text = addItemInput.value.trim();
      if (text) {
        await handleAddItem(tripId, currentList.id, text, container);
        addItemInput.value = '';
        addItemInput.focus();
      }
    };

    addItemBtn.addEventListener('click', addItem);
    addItemInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addItem();
      }
    });
  }

  // Item actions (delegated)
  container.querySelector('.list-items')?.addEventListener('click', async (e) => {
    const toggleCheckbox = e.target.closest('[data-action="toggle-item"]');
    const deleteBtn = e.target.closest('[data-action="delete-item"]');

    if (toggleCheckbox) {
      const itemId = toggleCheckbox.dataset.itemId;
      const checked = toggleCheckbox.checked;
      await handleToggleItem(tripId, currentList.id, itemId, checked, container);
    }

    if (deleteBtn) {
      const itemId = deleteBtn.dataset.itemId;
      await handleDeleteItem(tripId, currentList.id, itemId, container);
    }
  });

  // Bulk actions
  container.querySelector('[data-action="clear-checked"]')?.addEventListener('click', async () => {
    await handleClearChecked(tripId, currentList.id, container);
  });

  container.querySelector('[data-action="uncheck-all"]')?.addEventListener('click', async () => {
    await handleUncheckAll(tripId, currentList.id, container);
  });

  container.querySelector('[data-action="check-all"]')?.addEventListener('click', async () => {
    await handleCheckAll(tripId, currentList.id, container);
  });
}

/**
 * Open a specific list
 */
async function openList(listId, container) {
  try {
    currentList = await api.getList(currentTrip.id, listId);
    renderSingleListView(container);
    attachSingleListListeners(container, currentTrip.id);
  } catch (error) {
    logError('Failed to load list:', error);
    showToast(t('lists.loadListFailed'), 'error');
  }
}

/**
 * Show template selector modal
 */
function showTemplateSelector() {
  const modal = document.getElementById('template-modal');
  const container = document.getElementById('template-selector-container');

  const selectorHtml = createTemplateSelector(currentTemplates, {
    showCustomOption: true,
  });

  container.innerHTML = `
    <div class="modal-header">
      <h3>${t('lists.templateSelector.title')}</h3>
      <button class="btn btn-icon modal-close" data-action="close-modal">×</button>
    </div>
    <div class="modal-body">
      ${selectorHtml}
    </div>
  `;

  // Show modal
  requestAnimationFrame(() => {
    modal.classList.add('open');
  });

  // Close button
  container.querySelector('[data-action="close-modal"]')?.addEventListener('click', closeModals);

  // Template selection
  container.querySelectorAll('[data-action="select-template"]').forEach(card => {
    card.addEventListener('click', async () => {
      const templateId = card.dataset.templateId;
      await handleCreateFromTemplate(templateId);
    });
  });

  // Custom list creation
  container.querySelectorAll('[data-action="create-custom"]').forEach(card => {
    card.addEventListener('click', () => {
      const type = card.dataset.type;
      closeModals();
      showListForm(null, type);
    });
  });

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModals();
    }
  });
}

/**
 * Show list creation/edit form
 */
function showListForm(existingList = null, type = 'custom') {
  const modal = document.getElementById('list-modal');
  const container = document.getElementById('list-form-container');

  const formHtml = createListForm(existingList?.type || type, {
    existingList,
    templates: currentTemplates,
  });

  container.innerHTML = `
    <div class="modal-header">
      <h3>${existingList ? t('lists.form.editTitle', { type: '' }).trim() : t('lists.form.createTitle', { type: '' }).trim()}</h3>
      <button class="btn btn-icon modal-close" data-action="close-modal">×</button>
    </div>
    <div class="modal-body">
      ${formHtml}
    </div>
  `;

  // Show modal
  requestAnimationFrame(() => {
    modal.classList.add('open');
  });

  // Close button
  container.querySelector('[data-action="close-modal"]')?.addEventListener('click', closeModals);

  // Cancel button
  container.querySelector('[data-action="cancel-form"]')?.addEventListener('click', closeModals);

  // Form submission
  const form = container.querySelector('#list-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleListFormSubmit(form, existingList?.id);
  });

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModals();
    }
  });
}

/**
 * Close all modals
 */
function closeModals() {
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.classList.remove('open');
  });
}

/**
 * Handle list form submission
 */
async function handleListFormSubmit(form, existingListId) {
  const title = form.querySelector('#list-title').value.trim();
  const type = form.querySelector('#list-type').value;
  const templateId = form.querySelector('#list-template')?.value;

  if (!title) {
    showToast(t('lists.form.titleRequired'), 'error');
    return;
  }

  try {
    if (existingListId) {
      // Update existing list
      await api.updateList(currentTrip.id, existingListId, { title, type });
      showToast(t('lists.listUpdated'), 'success');
    } else if (templateId) {
      // Create from template
      await api.createListFromTemplate(currentTrip.id, templateId, { title });
      showToast(t('lists.listCreatedFromTemplate'), 'success');
    } else {
      // Create blank list
      await api.createList(currentTrip.id, { title, type, items: [] });
      showToast(t('lists.listCreated'), 'success');
    }

    closeModals();
    await refreshLists();

  } catch (error) {
    logError('Failed to save list:', error);
    showToast(error.message || t('lists.saveFailed'), 'error');
  }
}

/**
 * Handle creating list from template
 */
async function handleCreateFromTemplate(templateId) {
  try {
    const template = currentTemplates.find(t => t.id === templateId);
    if (!template) {
      showToast(t('errors.notFound'), 'error');
      return;
    }

    await api.createListFromTemplate(currentTrip.id, templateId, {
      title: template.name,
    });

    showToast(t('lists.listCreatedFromTemplate'), 'success');
    closeModals();
    await refreshLists();

  } catch (error) {
    logError('Failed to create from template:', error);
    showToast(error.message || t('lists.saveFailed'), 'error');
  }
}

/**
 * Handle list deletion
 */
async function handleDeleteList(tripId, listId, container) {
  const list = currentLists.find(l => l.id === listId);
  if (!await confirmDialog({ message: t('lists.confirmDeleteList', { name: list?.title || 'this list' }), variant: 'danger' })) {
    return;
  }

  try {
    await api.deleteList(tripId, listId);
    showToast(t('lists.listDeleted'), 'success');

    if (currentList?.id === listId) {
      currentList = null;
    }

    await refreshLists();

    // Go back to list manager if we were viewing the deleted list
    if (!currentList) {
      renderListManagerView(container);
      attachListManagerListeners(container, tripId);
    }

  } catch (error) {
    logError('Failed to delete list:', error);
    showToast(error.message || t('lists.deleteFailed'), 'error');
  }
}

/**
 * Handle adding item to list
 */
async function handleAddItem(tripId, listId, text, container) {
  try {
    currentList = await api.addListItem(tripId, listId, { text, checked: false });
    renderSingleListView(container);
    attachSingleListListeners(container, tripId);
  } catch (error) {
    logError('Failed to add item:', error);
    showToast(error.message || t('lists.addItemFailed'), 'error');
  }
}

/**
 * Handle toggling item checked state
 */
async function handleToggleItem(tripId, listId, itemId, checked, container) {
  try {
    currentList = await api.toggleListItem(tripId, listId, itemId, checked);
    // Update the UI without full re-render for better UX
    const itemElement = container.querySelector(`[data-item-id="${itemId}"]`);
    if (itemElement) {
      itemElement.classList.toggle('checked', checked);
      const textElement = itemElement.querySelector('.list-item-text');
      if (textElement) {
        textElement.classList.toggle('strikethrough', checked);
      }
    }
    updateProgressDisplay(container);
  } catch (error) {
    logError('Failed to toggle item:', error);
    showToast(error.message || t('lists.updateItemFailed'), 'error');
    // Re-render to restore state
    renderSingleListView(container);
    attachSingleListListeners(container, tripId);
  }
}

/**
 * Handle deleting item from list
 */
async function handleDeleteItem(tripId, listId, itemId, container) {
  try {
    currentList = await api.deleteListItem(tripId, listId, itemId);
    renderSingleListView(container);
    attachSingleListListeners(container, tripId);
  } catch (error) {
    logError('Failed to delete item:', error);
    showToast(error.message || t('lists.deleteItemFailed'), 'error');
  }
}

/**
 * Handle clearing checked items
 */
async function handleClearChecked(tripId, listId, container) {
  const uncheckedItems = currentList.items.filter(item => !item.checked);
  if (uncheckedItems.length === currentList.items.length) {
    showToast(t('lists.noCheckedItems'), 'info');
    return;
  }

  try {
    currentList = await api.updateListItems(tripId, listId, uncheckedItems);
    renderSingleListView(container);
    attachSingleListListeners(container, tripId);
    showToast(t('lists.checkedCleared'), 'success');
  } catch (error) {
    logError('Failed to clear checked items:', error);
    showToast(error.message || t('errors.generic'), 'error');
  }
}

/**
 * Handle unchecking all items
 */
async function handleUncheckAll(tripId, listId, container) {
  const updatedItems = currentList.items.map(item => ({ ...item, checked: false }));

  try {
    currentList = await api.updateListItems(tripId, listId, updatedItems);
    renderSingleListView(container);
    attachSingleListListeners(container, tripId);
  } catch (error) {
    logError('Failed to uncheck items:', error);
    showToast(error.message || t('errors.generic'), 'error');
  }
}

/**
 * Handle checking all items
 */
async function handleCheckAll(tripId, listId, container) {
  const updatedItems = currentList.items.map(item => ({ ...item, checked: true }));

  try {
    currentList = await api.updateListItems(tripId, listId, updatedItems);
    renderSingleListView(container);
    attachSingleListListeners(container, tripId);
  } catch (error) {
    logError('Failed to check items:', error);
    showToast(error.message || t('errors.generic'), 'error');
  }
}

/**
 * Update progress display without full re-render
 */
function updateProgressDisplay(container) {
  if (!currentList) return;

  const items = currentList.items || [];
  const total = items.length;
  const checked = items.filter(item => item.checked).length;
  const progress = total > 0 ? Math.round((checked / total) * 100) : 0;

  const progressCount = container.querySelector('.progress-count');
  const progressPercent = container.querySelector('.progress-percent');
  const progressFill = container.querySelector('.progress-fill');

  if (progressCount) {
    progressCount.textContent = `${checked} of ${total} items completed`;
  }
  if (progressPercent) {
    progressPercent.textContent = `${progress}%`;
  }
  if (progressFill) {
    progressFill.style.width = `${progress}%`;
    progressFill.classList.toggle('complete', progress === 100);
  }
}

/**
 * Setup sortable for list items
 */
function setupSortable() {
  const listContainer = document.querySelector('.list-items.sortable-list');
  if (!listContainer) return;

  // Cleanup existing instance
  if (sortableInstance) {
    sortableInstance.destroy();
  }

  sortableInstance = Sortable.create(listContainer, {
    animation: 150,
    handle: '.list-item-drag-handle',
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    onEnd: async (evt) => {
      if (evt.oldIndex !== evt.newIndex) {
        await handleReorderItems(evt);
      }
    },
  });
}

/**
 * Handle reordering items
 */
async function handleReorderItems(evt) {
  const listContainer = evt.from;
  const itemElements = listContainer.querySelectorAll('.list-item');
  const newOrder = Array.from(itemElements).map(el => el.dataset.itemId);

  try {
    currentList = await api.reorderListItems(currentTrip.id, currentList.id, newOrder);
  } catch (error) {
    logError('Failed to reorder items:', error);
    showToast(error.message || t('lists.reorderFailed'), 'error');
    // Re-render to restore original order
    const container = document.getElementById('page-container');
    renderSingleListView(container);
    attachSingleListListeners(container, currentTrip.id);
  }
}

/**
 * Refresh lists data
 */
async function refreshLists() {
  try {
    currentLists = await api.getLists(currentTrip.id);

    // Update current list if we have one open
    if (currentList) {
      currentList = currentLists.find(l => l.id === currentList.id) || null;
    }

    const container = document.getElementById('page-container');
    if (currentList) {
      renderSingleListView(container);
      attachSingleListListeners(container, currentTrip.id);
    } else {
      renderListManagerView(container);
      attachListManagerListeners(container, currentTrip.id);
    }

  } catch (error) {
    logError('Failed to refresh lists:', error);
    showToast(t('errors.generic'), 'error');
  }
}

/**
 * Cleanup function when leaving page
 */
export function cleanupListsPage() {
  if (sortableInstance) {
    sortableInstance.destroy();
    sortableInstance = null;
  }

  currentTrip = null;
  currentLists = [];
  currentList = null;
  currentTemplates = [];
  currentFilter = 'all';
}
