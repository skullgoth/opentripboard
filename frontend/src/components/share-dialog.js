// US9: Share dialog component for generating and managing share links
import apiClient from '../services/api-client.js';
import { showToast } from '../utils/toast.js';
import { t } from '../utils/i18n.js';
import { confirmDialog } from '../utils/confirm-dialog.js';
import { logError } from '../utils/error-tracking.js';

let currentTripId = null;
let shareTokens = [];

/**
 * Show share dialog for a trip
 * @param {string} tripId - Trip ID
 */
export async function showShareDialog(tripId) {
  currentTripId = tripId;

  // Create dialog if it doesn't exist
  let dialog = document.getElementById('share-dialog');
  if (!dialog) {
    dialog = createShareDialog();
    document.body.appendChild(dialog);
  }

  // Load existing share links
  await loadShareLinks();

  // Show dialog
  dialog.classList.add('open');
}

/**
 * Hide share dialog
 */
export function hideShareDialog() {
  const dialog = document.getElementById('share-dialog');
  if (dialog) {
    dialog.classList.remove('open');
  }
}

/**
 * Create share dialog HTML
 */
function createShareDialog() {
  const dialog = document.createElement('div');
  dialog.id = 'share-dialog';
  dialog.className = 'modal-overlay';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-labelledby', 'share-dialog-title');
  dialog.innerHTML = `
    <div class="modal-dialog modal-dialog-lg">
      <div class="modal-header">
        <h2 id="share-dialog-title">${t('share.shareTrip')}</h2>
        <button type="button" class="btn btn-icon" id="close-share-dialog" aria-label="${t('common.close')}">&times;</button>
      </div>
      <div class="modal-body">
        <div class="share-create-section">
          <h3>${t('share.createNewLink')}</h3>
          <div class="share-options">
                        <div class="form-group">
              <label class="form-label">${t('share.expires')}</label>
              <select id="share-expires" class="form-select">
                <option value="never">${t('share.never')}</option>
                <option value="1d">${t('share.oneDay')}</option>
                <option value="7d">${t('share.sevenDays')}</option>
                <option value="30d">${t('share.thirtyDays')}</option>
              </select>
            </div>
            <button type="button" class="btn btn-primary" id="create-share-link">
              ${t('share.createLink')}
            </button>
          </div>
        </div>

        <div class="share-links-section">
          <h3>${t('share.activeLinks')}</h3>
          <div id="share-links-list" class="share-links-list">
            <p class="text-muted">${t('share.noLinks')}</p>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach event listeners
  dialog.querySelector('#close-share-dialog').addEventListener('click', hideShareDialog);
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) hideShareDialog();
  });
  dialog.querySelector('#create-share-link').addEventListener('click', handleCreateShareLink);

  return dialog;
}

/**
 * Load existing share links
 */
async function loadShareLinks() {
  try {
    const response = await apiClient.get(`/trips/${currentTripId}/share`);
    shareTokens = response.shareTokens || [];
    renderShareLinks();
  } catch (error) {
    logError('Failed to load share links:', error);
    shareTokens = [];
    renderShareLinks();
  }
}

/**
 * Render share links list
 */
function renderShareLinks() {
  const container = document.getElementById('share-links-list');
  if (!container) return;

  if (shareTokens.length === 0) {
    container.innerHTML = `<p class="text-muted">${t('share.noLinks')}</p>`;
    return;
  }

  container.innerHTML = shareTokens
    .map(
      (token) => `
    <div class="share-link-item" data-token-id="${token.id}">
      <div class="share-link-info">
        <div class="share-link-url">
          <input type="text" readonly value="${token.shareUrl}" class="form-input share-url-input" />
          <button type="button" class="btn btn-sm btn-secondary copy-btn" data-url="${token.shareUrl}" aria-label="${t('share.copyToClipboard')}">
            ${t('share.copy')}
          </button>
        </div>
        <div class="share-link-meta">
          ${token.expiresAt ? `<span class="share-expires">${t('share.expiresOn')}: ${formatDate(token.expiresAt)}</span>` : `<span class="share-expires">${t('share.neverExpires')}</span>`}
          <span class="share-created">${t('share.created')}: ${formatDate(token.createdAt)}</span>
        </div>
      </div>
      <div class="share-link-actions">
        <button type="button" class="btn btn-sm btn-danger delete-share-btn" data-token-id="${token.id}" aria-label="${t('share.deleteLink')}">
          ${t('common.delete')}
        </button>
      </div>
    </div>
  `
    )
    .join('');

  // Attach event listeners
  container.querySelectorAll('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', () => handleCopyLink(btn.dataset.url));
  });

  container.querySelectorAll('.delete-share-btn').forEach((btn) => {
    btn.addEventListener('click', () => handleDeleteShareLink(btn.dataset.tokenId));
  });
}

/**
 * Handle create share link
 */
async function handleCreateShareLink() {
  const expiresIn = document.getElementById('share-expires').value;

  try {
    const response = await apiClient.post(`/trips/${currentTripId}/share`, {
      permission: 'view',
      expiresIn,
    });

    shareTokens.unshift(response.shareToken);
    renderShareLinks();

    // Auto-copy new link
    await handleCopyLink(response.shareToken.shareUrl);
    showToast(t('share.linkCreatedAndCopied'), 'success');
  } catch (error) {
    logError('Failed to create share link:', error);
    showToast(error.message || t('share.createFailed'), 'error');
  }
}

/**
 * Handle copy link to clipboard
 */
async function handleCopyLink(url) {
  try {
    await navigator.clipboard.writeText(url);
    showToast(t('share.linkCopied'), 'success');
  } catch (error) {
    // Fallback for older browsers
    const input = document.createElement('input');
    input.value = url;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    showToast(t('share.linkCopied'), 'success');
  }
}

/**
 * Handle delete share link
 */
async function handleDeleteShareLink(tokenId) {
  if (!await confirmDialog({ message: t('share.confirmDelete'), variant: 'danger' })) {
    return;
  }

  try {
    await apiClient.del(`/trips/${currentTripId}/share/${tokenId}`);
    shareTokens = shareTokens.filter((tk) => tk.id !== tokenId);
    renderShareLinks();
    showToast(t('share.linkDeleted'), 'success');
  } catch (error) {
    logError('Failed to delete share link:', error);
    showToast(error.message || t('share.deleteFailed'), 'error');
  }
}

/**
 * Format date for display
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
