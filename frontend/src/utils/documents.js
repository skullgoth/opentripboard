// T229: Document utility functions
// T035/T036: Updated to support dynamic categories
import { t } from './i18n.js';
import { buildCategoryOptions, getCategoryIcon as resolveCategoryIcon, getCategoryName } from './category-resolver.js';
import { getCategories as getCategoriesState } from '../state/categories-state.js';

/**
 * Format file size to human readable string
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get icon type based on mime type
 * @param {string} mimeType - File MIME type
 * @returns {string} Icon type (pdf, image, doc, text, file)
 */
export function getFileIcon(mimeType) {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'doc';
  if (mimeType === 'text/plain') return 'text';
  return 'file';
}

/**
 * Get category label
 * T036: Now uses category resolver for custom categories
 * @param {string} category - Category ID or custom:uuid
 * @returns {string} Human readable label
 */
export function getCategoryLabel(category) {
  return getCategoryName(category, 'document');
}

/**
 * Get category color class
 * @param {string} category - Category ID
 * @returns {string} Color class
 */
export function getCategoryColor(category) {
  const colors = {
    passport: 'blue',
    visa: 'purple',
    ticket: 'green',
    reservation: 'orange',
    insurance: 'red',
    itinerary: 'cyan',
    photo: 'pink',
    other: 'gray',
  };
  return colors[category] || 'gray';
}

/**
 * Get category icon
 * T036: Now uses category resolver for custom categories
 * @param {string} category - Category ID or custom:uuid
 * @returns {string} Emoji icon
 */
export function getCategoryIcon(category) {
  return resolveCategoryIcon(category, 'document');
}

/**
 * Get allowed file types for upload
 * @returns {string} Accept attribute value
 */
export function getAllowedFileTypes() {
  return '.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.gif,.txt';
}

/**
 * Get allowed MIME types
 * @returns {Array} Array of allowed MIME types
 */
export function getAllowedMimeTypes() {
  return [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'text/plain',
  ];
}

/**
 * Validate file for upload
 * @param {File} file - File to validate
 * @returns {Object} { valid: boolean, error?: string }
 */
export function validateFile(file) {
  const maxSizeMB = parseInt(import.meta.env.VITE_MAX_UPLOAD_SIZE_MB, 10) || 10;
  const maxSize = maxSizeMB * 1024 * 1024;

  if (!file) {
    return { valid: false, error: t('documents.uploadErrors.noFileSelected') };
  }

  if (file.size > maxSize) {
    return { valid: false, error: t('documents.uploadErrors.fileTooLarge') };
  }

  const allowedTypes = getAllowedMimeTypes();
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: t('documents.uploadErrors.invalidType') };
  }

  return { valid: true };
}

/**
 * Get all document categories
 * T035: Updated to include custom categories from state
 * @returns {Array} Array of category objects { id, label, icon, isCustom? }
 */
export function getDocumentCategories() {
  // Get categories from state (includes defaults + custom)
  const categories = getCategoriesState();

  // Build options using correct signature: buildCategoryOptions(domain, defaults, custom)
  // categories.defaults and categories.custom are objects keyed by domain
  const defaults = categories?.defaults?.document || [];
  const custom = categories?.custom?.document || [];
  const categoryOptions = buildCategoryOptions('document', defaults, custom);

  // Convert flat array to expected format: { id, label, icon }
  const result = [];

  categoryOptions.forEach(item => {
    if (item.groupLabel) {
      // This is a grouped set (e.g., custom categories)
      item.options.forEach(opt => {
        result.push({
          id: opt.value,
          label: opt.label,
          icon: opt.icon,
          isCustom: opt.isCustom || false,
        });
      });
    } else {
      // This is a flat option
      result.push({
        id: item.value,
        label: item.label,
        icon: item.icon,
        isCustom: item.isCustom || false,
      });
    }
  });

  return result;
}
