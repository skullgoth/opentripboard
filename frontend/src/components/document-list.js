// T229: Document List Component
// Displays list of documents with filtering and actions

import { formatFileSize, getFileIcon, getCategoryLabel, getCategoryColor } from '../utils/documents.js';
import { t } from '../utils/i18n.js';
import { escapeHtml } from '../utils/html.js';

/**
 * Create the document list component
 * @param {Array} documents - Array of documents
 * @param {Object} options - Options (showCategory, showUploader, currentUserId)
 * @returns {string} HTML string
 */
export function createDocumentList(documents, options = {}) {
  const { showCategory = true, showUploader = true, currentUserId } = options;

  if (!documents || documents.length === 0) {
    return `
      <div class="document-list-empty">
        <div class="empty-state">
          <div class="empty-icon">📄</div>
          <h3>${t('documents.noDocuments')}</h3>
          <p>${t('documents.noDocumentsDescription')}</p>
        </div>
      </div>
    `;
  }

  const documentItems = documents.map(doc => createDocumentItem(doc, { showCategory, showUploader, currentUserId })).join('');

  return `
    <div class="document-list">
      ${documentItems}
    </div>
  `;
}

/**
 * Create a single document item
 * @param {Object} document - Document data
 * @param {Object} options - Display options
 * @returns {string} HTML string
 */
export function createDocumentItem(document, options = {}) {
  const { showCategory = true, showUploader = true, currentUserId } = options;
  const iconType = getFileIcon(document.fileType);
  const canEdit = currentUserId === document.uploadedBy;

  return `
    <div class="document-item" data-document-id="${document.id}">
      <div class="document-icon document-icon-${iconType}">
        ${getIconSvg(iconType)}
      </div>
      <div class="document-info">
        <div class="document-name" title="${escapeHtml(document.fileName)}">
          ${escapeHtml(document.fileName)}
        </div>
        <div class="document-meta">
          <span class="document-size">${formatFileSize(document.fileSize)}</span>
          ${showCategory && document.category ? `
            <span class="document-category category-${document.category}">
              ${getCategoryLabel(document.category)}
            </span>
          ` : ''}
          ${showUploader && document.uploadedByName ? `
            <span class="document-uploader">${t('documents.uploadedBy', { name: escapeHtml(document.uploadedByName) })}</span>
          ` : ''}
        </div>
        ${document.description ? `
          <div class="document-description">${escapeHtml(document.description)}</div>
        ` : ''}
      </div>
      <div class="document-actions">
        <button type="button" class="btn btn-icon btn-sm" data-action="download-document" data-document-id="${document.id}" title="${t('common.download')}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7,10 12,15 17,10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
        ${canEdit ? `
          <button type="button" class="btn btn-icon btn-sm" data-action="edit-document" data-document-id="${document.id}" title="${t('common.edit')}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button type="button" class="btn btn-icon btn-sm btn-danger" data-action="delete-document" data-document-id="${document.id}" title="${t('common.delete')}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3,6 5,6 21,6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Create category filter tabs
 * @param {Object} categoryCounts - Counts per category
 * @param {string} activeCategory - Currently active category (null for all)
 * @returns {string} HTML string
 */
export function createCategoryTabs(categoryCounts, activeCategory = null) {
  const categories = [
    { id: null, label: t('documents.categoryTabs.all'), icon: '📁' },
    { id: 'ticket', label: t('documents.categoryTabs.ticket'), icon: '🎫' },
    { id: 'reservation', label: t('documents.categoryTabs.reservation'), icon: '🏨' },
    { id: 'passport', label: t('documents.categoryTabs.passport'), icon: '🪪' },
    { id: 'visa', label: t('documents.categoryTabs.visa'), icon: '📋' },
    { id: 'insurance', label: t('documents.categoryTabs.insurance'), icon: '🛡️' },
    { id: 'itinerary', label: t('documents.categoryTabs.itinerary'), icon: '🗺️' },
    { id: 'photo', label: t('documents.categoryTabs.photo'), icon: '📷' },
    { id: 'other', label: t('documents.categoryTabs.other'), icon: '📄' },
  ];

  const totalCount = Object.values(categoryCounts).reduce((a, b) => a + b, 0);

  return `
    <div class="document-category-tabs">
      ${categories.map(cat => {
        const count = cat.id === null ? totalCount : (categoryCounts[cat.id] || 0);
        const isActive = activeCategory === cat.id;
        return `
          <button type="button"
            class="category-tab ${isActive ? 'active' : ''}"
            data-category="${cat.id || ''}"
            ${count === 0 && cat.id !== null ? 'disabled' : ''}
          >
            <span class="category-icon">${cat.icon}</span>
            <span class="category-label">${cat.label}</span>
            <span class="category-count">${count}</span>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * Create document stats summary
 * @param {Object} stats - Document stats
 * @returns {string} HTML string
 */
export function createDocumentStats(stats) {
  const { totalDocuments, storageUsage, categoryCounts } = stats;

  return `
    <div class="document-stats">
      <div class="stat-item">
        <span class="stat-value">${totalDocuments}</span>
        <span class="stat-label">${t('documents.stats.documents')}</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${formatFileSize(storageUsage)}</span>
        <span class="stat-label">${t('documents.stats.storageUsed')}</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${Object.keys(categoryCounts).length}</span>
        <span class="stat-label">${t('documents.stats.categories')}</span>
      </div>
    </div>
  `;
}

/**
 * Get SVG icon for file type
 * @param {string} iconType - Icon type (pdf, image, doc, text, file)
 * @returns {string} SVG HTML
 */
function getIconSvg(iconType) {
  const icons = {
    pdf: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14,2 14,8 20,8"/>
      <text x="8" y="17" font-size="6" fill="currentColor" stroke="none">PDF</text>
    </svg>`,
    image: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21,15 16,10 5,21"/>
    </svg>`,
    doc: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14,2 14,8 20,8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10,9 9,9 8,9"/>
    </svg>`,
    text: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14,2 14,8 20,8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>`,
    file: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14,2 14,8 20,8"/>
    </svg>`,
  };

  return icons[iconType] || icons.file;
}

