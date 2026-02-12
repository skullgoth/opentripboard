// T229: Documents page
// Document storage and management for trips

import { createDocumentList, createCategoryTabs, createDocumentStats } from '../components/document-list.js';
import { createDocumentUploadForm, createDocumentEditForm, initUploadFormHandlers, getUploadFormData, getEditFormData } from '../components/document-upload.js';
import { showToast } from '../utils/toast.js';
import { confirmDialog } from '../utils/confirm-dialog.js';
import { app } from '../main.js';
import { tripState } from '../state/trip-state.js';
import { authState } from '../state/auth-state.js';
import * as api from '../services/api-client.js';
import { t } from '../utils/i18n.js';
import { escapeHtml } from '../utils/html.js';

let currentTrip = null;
let currentDocuments = [];
let currentStats = {};
let currentActivities = [];
let activeCategory = null;

/**
 * Render documents page
 * @param {Object} params - Route parameters
 */
export async function documentsPage(params) {
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
      <p>${t('documents.loading')}</p>
    </div>
  `;

  try {
    // Load trip, documents, stats, and activities
    const [trip, documents, stats, activities] = await Promise.all([
      tripState.loadTrip(tripId),
      api.getDocuments(tripId),
      api.getDocumentStats(tripId),
      api.get(`/trips/${tripId}/activities`),
    ]);

    currentTrip = trip;
    currentDocuments = documents;
    currentStats = stats;
    currentActivities = activities;
    activeCategory = null;

    renderPage(container);
    attachEventListeners(container, tripId);

  } catch (error) {
    console.error('Failed to load documents:', error);
    container.innerHTML = `
      <div class="error-page">
        <h2>${t('documents.loadFailed')}</h2>
        <p>${error.message || t('errors.generic')}</p>
        <a href="#/trips/${tripId}" class="btn btn-sm btn-primary">${t('documents.backToTrip')}</a>
      </div>
    `;
  }
}

/**
 * Render the page content
 */
function renderPage(container) {
  const currentUser = authState.getCurrentUser();

  // Filter documents by category
  const filteredDocuments = activeCategory
    ? currentDocuments.filter(d => d.category === activeCategory)
    : currentDocuments;

  // Create components
  const statsHtml = createDocumentStats(currentStats);
  const tabsHtml = createCategoryTabs(currentStats.categoryCounts || {}, activeCategory);
  const documentListHtml = createDocumentList(filteredDocuments, {
    showCategory: !activeCategory,
    showUploader: true,
    currentUserId: currentUser?.id,
  });

  container.innerHTML = `
    <div class="documents-page">
      <div class="page-header">
        <div class="page-header-content">
          <a href="#/trips/${currentTrip.id}" class="btn btn-secondary btn-sm">
            ← ${t('documents.backToTrip')}
          </a>
          <h1>${t('documents.title')}</h1>
          <p class="page-subtitle">${escapeHtml(currentTrip.name)}</p>
        </div>
      </div>

      <div class="documents-page-content">
        <div class="documents-main">
          <div class="documents-header">
            <div class="documents-stats-row">
              ${statsHtml}
            </div>
            <button type="button" class="btn btn-primary" data-action="upload-document">
              + ${t('documents.uploadDocument')}
            </button>
          </div>

          <div class="documents-filters">
            ${tabsHtml}
          </div>

          <div class="documents-list-container" id="documents-list">
            ${documentListHtml}
          </div>
        </div>
      </div>

      <!-- Upload Modal -->
      <div id="upload-modal" class="modal-overlay">
        <div class="modal-dialog">
          <div id="upload-form-container"></div>
        </div>
      </div>

      <!-- Edit Modal -->
      <div id="edit-modal" class="modal-overlay">
        <div class="modal-dialog">
          <div id="edit-form-container"></div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Attach event listeners
 */
function attachEventListeners(container, tripId) {
  // Upload button
  container.querySelector('[data-action="upload-document"]')?.addEventListener('click', () => {
    showUploadModal();
  });

  // Category tabs
  container.querySelector('.document-category-tabs')?.addEventListener('click', (e) => {
    const tab = e.target.closest('.category-tab');
    if (tab && !tab.disabled) {
      const category = tab.dataset.category || null;
      activeCategory = category || null;
      refreshDocumentList();

      // Update active tab
      container.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    }
  });

  // Document list actions (delegated)
  container.querySelector('#documents-list')?.addEventListener('click', (e) => {
    const downloadBtn = e.target.closest('[data-action="download-document"]');
    const editBtn = e.target.closest('[data-action="edit-document"]');
    const deleteBtn = e.target.closest('[data-action="delete-document"]');

    if (downloadBtn) {
      const documentId = downloadBtn.dataset.documentId;
      handleDownload(tripId, documentId);
    }

    if (editBtn) {
      const documentId = editBtn.dataset.documentId;
      const doc = currentDocuments.find(d => d.id === documentId);
      if (doc) {
        showEditModal(doc);
      }
    }

    if (deleteBtn) {
      const documentId = deleteBtn.dataset.documentId;
      handleDelete(tripId, documentId);
    }
  });

  // Modal close on overlay click
  container.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModals();
      }
    });
  });
}

/**
 * Show upload modal
 */
function showUploadModal() {
  const modal = document.getElementById('upload-modal');
  const formContainer = document.getElementById('upload-form-container');

  const formHtml = createDocumentUploadForm({
    activities: currentActivities,
  });

  formContainer.innerHTML = formHtml;

  // Show modal
  requestAnimationFrame(() => {
    modal.classList.add('open');
  });

  // Initialize form handlers
  initUploadFormHandlers(formContainer);

  // Handle form submit
  const form = formContainer.querySelector('#document-upload-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleUpload(form);
  });

  // Handle cancel
  formContainer.querySelectorAll('[data-action="cancel-upload"]').forEach(btn => {
    btn.addEventListener('click', closeModals);
  });
}

/**
 * Show edit modal
 */
function showEditModal(doc) {
  const modal = document.getElementById('edit-modal');
  const formContainer = document.getElementById('edit-form-container');

  const formHtml = createDocumentEditForm(doc, {
    activities: currentActivities,
  });

  formContainer.innerHTML = formHtml;

  // Show modal
  requestAnimationFrame(() => {
    modal.classList.add('open');
  });

  // Handle form submit
  const form = formContainer.querySelector('#document-edit-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleEdit(form, doc.id);
  });

  // Handle cancel
  formContainer.querySelectorAll('[data-action="cancel-edit"]').forEach(btn => {
    btn.addEventListener('click', closeModals);
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
 * Handle document upload
 */
async function handleUpload(form) {
  const submitBtn = form.querySelector('#upload-submit-btn');
  const btnText = submitBtn.querySelector('.btn-text');
  const btnLoading = submitBtn.querySelector('.btn-loading');

  // Show loading state
  btnText.style.display = 'none';
  btnLoading.style.display = 'inline-flex';
  submitBtn.disabled = true;

  try {
    const formData = getUploadFormData(form);
    await api.uploadDocument(currentTrip.id, formData);

    showToast(t('documents.uploadSuccess'), 'success');
    closeModals();
    await refreshData();

  } catch (error) {
    console.error('Upload failed:', error);
    showToast(error.message || t('documents.uploadFailed'), 'error');

    // Reset button
    btnText.style.display = 'inline';
    btnLoading.style.display = 'none';
    submitBtn.disabled = false;
  }
}

/**
 * Handle document edit
 */
async function handleEdit(form, documentId) {
  try {
    const updates = getEditFormData(form);
    await api.updateDocument(currentTrip.id, documentId, updates);

    showToast(t('documents.updateSuccess'), 'success');
    closeModals();
    await refreshData();

  } catch (error) {
    console.error('Update failed:', error);
    showToast(error.message || t('documents.updateFailed'), 'error');
  }
}

/**
 * Handle document download
 */
async function handleDownload(tripId, documentId) {
  const doc = currentDocuments.find(d => d.id === documentId);
  try {
    await api.downloadDocument(tripId, documentId, doc?.fileName);
  } catch (error) {
    console.error('Download failed:', error);
    showToast(error.message || t('documents.downloadFailed'), 'error');
  }
}

/**
 * Handle document delete
 */
async function handleDelete(tripId, documentId) {
  if (!await confirmDialog({ message: t('documents.confirmDelete'), variant: 'danger' })) {
    return;
  }

  try {
    await api.deleteDocument(tripId, documentId);
    showToast(t('documents.deleted'), 'success');
    await refreshData();

  } catch (error) {
    console.error('Delete failed:', error);
    showToast(error.message || t('documents.deleteFailed'), 'error');
  }
}

/**
 * Refresh all data
 */
async function refreshData() {
  try {
    const [documents, stats] = await Promise.all([
      api.getDocuments(currentTrip.id),
      api.getDocumentStats(currentTrip.id),
    ]);

    currentDocuments = documents;
    currentStats = stats;

    // Re-render page
    const container = document.getElementById('page-container');
    renderPage(container);
    attachEventListeners(container, currentTrip.id);

  } catch (error) {
    console.error('Failed to refresh data:', error);
    showToast(t('errors.generic'), 'error');
  }
}

/**
 * Refresh just the document list
 */
function refreshDocumentList() {
  const currentUser = authState.getCurrentUser();
  const filteredDocuments = activeCategory
    ? currentDocuments.filter(d => d.category === activeCategory)
    : currentDocuments;

  const documentListHtml = createDocumentList(filteredDocuments, {
    showCategory: !activeCategory,
    showUploader: true,
    currentUserId: currentUser?.id,
  });

  const listContainer = document.getElementById('documents-list');
  if (listContainer) {
    listContainer.innerHTML = documentListHtml;
  }
}

/**
 * Cleanup function when leaving page
 */
export function cleanupDocumentsPage() {
  currentTrip = null;
  currentDocuments = [];
  currentStats = {};
  currentActivities = [];
  activeCategory = null;
}
