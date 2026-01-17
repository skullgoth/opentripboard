// T229: Document Upload Component
// Form for uploading documents with category and description

import { getAllowedFileTypes, getDocumentCategories, validateFile, formatFileSize } from '../utils/documents.js';
import { t } from '../utils/i18n.js';

/**
 * Create the document upload form
 * @param {Object} options - Options (activities for linking)
 * @returns {string} HTML string
 */
export function createDocumentUploadForm(options = {}) {
  const { activities = [] } = options;
  const categories = getDocumentCategories();

  return `
    <form id="document-upload-form" class="document-upload-form">
      <div class="modal-header">
        <h3>${t('documents.uploadDocument')}</h3>
        <button type="button" class="btn btn-icon" data-action="cancel-upload">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label for="document-file">${t('documents.fileRequired')}</label>
          <div class="file-upload-area" id="file-upload-area">
            <input type="file" id="document-file" name="file" accept="${getAllowedFileTypes()}" required />
            <div class="file-upload-placeholder">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17,8 12,3 7,8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <p>${t('documents.clickToSelect')}</p>
              <span class="file-types">${t('documents.fileTypesHint')}</span>
            </div>
            <div class="file-upload-preview" id="file-preview" style="display: none;">
              <span class="file-name" id="preview-file-name"></span>
              <span class="file-size" id="preview-file-size"></span>
              <button type="button" class="btn btn-icon btn-sm" data-action="clear-file">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="form-error" id="file-error" style="display: none;"></div>
        </div>

        <div class="form-group">
          <label for="document-category">${t('documents.category')}</label>
          <select id="document-category" name="category">
            ${categories.map(cat => `
              <option value="${cat.id}">${cat.icon} ${cat.label}</option>
            `).join('')}
          </select>
        </div>

        <div class="form-group">
          <label for="document-description">${t('documents.descriptionOptional')}</label>
          <textarea
            id="document-description"
            name="description"
            rows="2"
            maxlength="1000"
            placeholder="${t('documents.descriptionPlaceholder')}"
          ></textarea>
        </div>

        ${activities.length > 0 ? `
          <div class="form-group">
            <label for="document-activity">${t('documents.linkToActivity')}</label>
            <select id="document-activity" name="activityId">
              <option value="">${t('documents.noActivity')}</option>
              ${activities.map(act => `
                <option value="${act.id}">${escapeHtml(act.title)}</option>
              `).join('')}
            </select>
            <p class="form-hint">${t('documents.linkToActivityHint')}</p>
          </div>
        ` : ''}
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-action="cancel-upload">${t('common.cancel')}</button>
        <button type="submit" class="btn btn-primary" id="upload-submit-btn">
          <span class="btn-text">${t('documents.upload')}</span>
          <span class="btn-loading" style="display: none;">
            <span class="spinner-sm"></span>
            ${t('documents.uploading')}
          </span>
        </button>
      </div>
    </form>
  `;
}

/**
 * Create document edit form
 * @param {Object} document - Document to edit
 * @param {Object} options - Options (activities for linking)
 * @returns {string} HTML string
 */
export function createDocumentEditForm(document, options = {}) {
  const { activities = [] } = options;
  const categories = getDocumentCategories();

  return `
    <form id="document-edit-form" class="document-edit-form" data-document-id="${document.id}">
      <div class="modal-header">
        <h3>${t('documents.editDocument')}</h3>
        <button type="button" class="btn btn-icon" data-action="cancel-edit">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <div class="document-file-info">
          <div class="file-icon">📄</div>
          <div class="file-details">
            <span class="file-name">${escapeHtml(document.fileName)}</span>
            <span class="file-size">${formatFileSize(document.fileSize)}</span>
          </div>
        </div>

        <div class="form-group">
          <label for="edit-document-category">${t('documents.category')}</label>
          <select id="edit-document-category" name="category">
            ${categories.map(cat => `
              <option value="${cat.id}" ${document.category === cat.id ? 'selected' : ''}>
                ${cat.icon} ${cat.label}
              </option>
            `).join('')}
          </select>
        </div>

        <div class="form-group">
          <label for="edit-document-description">${t('activity.description')}</label>
          <textarea
            id="edit-document-description"
            name="description"
            rows="2"
            maxlength="1000"
            placeholder="${t('documents.descriptionPlaceholder')}"
          >${escapeHtml(document.description || '')}</textarea>
        </div>

        ${activities.length > 0 ? `
          <div class="form-group">
            <label for="edit-document-activity">${t('documents.linkToActivity')}</label>
            <select id="edit-document-activity" name="activityId">
              <option value="">${t('documents.noActivity')}</option>
              ${activities.map(act => `
                <option value="${act.id}" ${document.activityId === act.id ? 'selected' : ''}>
                  ${escapeHtml(act.title)}
                </option>
              `).join('')}
            </select>
          </div>
        ` : ''}
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-action="cancel-edit">${t('common.cancel')}</button>
        <button type="submit" class="btn btn-primary">${t('documents.saveChanges')}</button>
      </div>
    </form>
  `;
}

/**
 * Initialize upload form handlers
 * @param {HTMLElement} container - Form container
 * @returns {void}
 */
export function initUploadFormHandlers(container) {
  const fileInput = container.querySelector('#document-file');
  const uploadArea = container.querySelector('#file-upload-area');
  const placeholder = container.querySelector('.file-upload-placeholder');
  const preview = container.querySelector('#file-preview');
  const fileNameEl = container.querySelector('#preview-file-name');
  const fileSizeEl = container.querySelector('#preview-file-size');
  const errorEl = container.querySelector('#file-error');
  const clearBtn = container.querySelector('[data-action="clear-file"]');

  // Handle file selection
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      handleFileSelection(file, { placeholder, preview, fileNameEl, fileSizeEl, errorEl });
    });
  }

  // Handle drag and drop
  if (uploadArea) {
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file && fileInput) {
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        handleFileSelection(file, { placeholder, preview, fileNameEl, fileSizeEl, errorEl });
      }
    });
  }

  // Handle clear file
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (fileInput) fileInput.value = '';
      if (placeholder) placeholder.style.display = 'flex';
      if (preview) preview.style.display = 'none';
      if (errorEl) errorEl.style.display = 'none';
    });
  }
}

/**
 * Handle file selection
 * @param {File} file - Selected file
 * @param {Object} elements - UI elements
 */
function handleFileSelection(file, { placeholder, preview, fileNameEl, fileSizeEl, errorEl }) {
  if (!file) return;

  const validation = validateFile(file);

  if (!validation.valid) {
    if (errorEl) {
      errorEl.textContent = validation.error;
      errorEl.style.display = 'block';
    }
    if (placeholder) placeholder.style.display = 'flex';
    if (preview) preview.style.display = 'none';
    return;
  }

  // Show preview
  if (errorEl) errorEl.style.display = 'none';
  if (placeholder) placeholder.style.display = 'none';
  if (preview) preview.style.display = 'flex';
  if (fileNameEl) fileNameEl.textContent = file.name;
  if (fileSizeEl) fileSizeEl.textContent = formatFileSize(file.size);
}

/**
 * Get form data from upload form
 * @param {HTMLFormElement} form - Form element
 * @returns {FormData} Form data ready for upload
 */
export function getUploadFormData(form) {
  const formData = new FormData();

  // IMPORTANT: Text fields must come BEFORE the file for Fastify multipart parsing
  const category = form.querySelector('#document-category')?.value;
  if (category) {
    formData.append('category', category);
  }

  const description = form.querySelector('#document-description')?.value;
  if (description) {
    formData.append('description', description);
  }

  const activityId = form.querySelector('#document-activity')?.value;
  if (activityId) {
    formData.append('activityId', activityId);
  }

  // File must come LAST for proper multipart parsing
  const fileInput = form.querySelector('#document-file');
  if (fileInput && fileInput.files[0]) {
    formData.append('file', fileInput.files[0]);
  }

  return formData;
}

/**
 * Get edit form data
 * @param {HTMLFormElement} form - Form element
 * @returns {Object} Update data
 */
export function getEditFormData(form) {
  return {
    category: form.querySelector('#edit-document-category')?.value,
    description: form.querySelector('#edit-document-description')?.value || null,
    activityId: form.querySelector('#edit-document-activity')?.value || null,
  };
}

/**
 * Escape HTML
 */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
