// Export modal component for selecting export format
import { t } from '../utils/i18n.js';
import { showToast } from '../utils/toast.js';
import { getItem } from '../utils/storage.js';

let currentTrip = null;

/**
 * Show export modal for a trip
 * @param {Object} trip - Trip object
 */
export function showExportModal(trip) {
  currentTrip = trip;

  // Create modal if it doesn't exist
  let modal = document.getElementById('export-modal');
  if (!modal) {
    modal = createExportModal();
    document.body.appendChild(modal);
  }

  // Show modal
  modal.classList.add('open');
}

/**
 * Hide export modal
 */
export function hideExportModal() {
  const modal = document.getElementById('export-modal');
  if (modal) {
    modal.classList.remove('open');
  }
}

/**
 * Create export modal HTML
 */
function createExportModal() {
  const modal = document.createElement('div');
  modal.id = 'export-modal';
  modal.className = 'modal-overlay';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'export-modal-title');
  modal.innerHTML = `
    <div class="modal-dialog modal-dialog-sm">
      <div class="modal-header">
        <h2 class="modal-title" id="export-modal-title">${t('export.exportTrip')}</h2>
        <button type="button" class="btn btn-icon" id="close-export-modal" aria-label="${t('common.close')}">&times;</button>
      </div>
      <div class="modal-body">
        <form id="export-form">
          <div class="form-group">
            <label class="form-label">${t('export.selectFormat')}</label>
            <div class="export-format-options">
              <label class="export-format-option">
                <input type="radio" name="export-format" value="pdf" checked />
                <span class="export-format-label">
                  <span class="export-format-icon">📄</span>
                  <span class="export-format-name">${t('export.pdf')}</span>
                  <span class="export-format-desc">${t('export.pdfDescription')}</span>
                </span>
              </label>
              <label class="export-format-option">
                <input type="radio" name="export-format" value="json" />
                <span class="export-format-label">
                  <span class="export-format-icon">📋</span>
                  <span class="export-format-name">${t('export.json')}</span>
                  <span class="export-format-desc">${t('export.jsonDescription')}</span>
                </span>
              </label>
            </div>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" id="cancel-export">${t('common.cancel')}</button>
        <button type="button" class="btn btn-primary" id="confirm-export">${t('export.download')}</button>
      </div>
    </div>
  `;

  // Attach event listeners
  modal.querySelector('#close-export-modal').addEventListener('click', hideExportModal);
  modal.querySelector('#cancel-export').addEventListener('click', hideExportModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) hideExportModal();
  });
  modal.querySelector('#confirm-export').addEventListener('click', handleExport);

  // Handle keyboard events
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideExportModal();
    }
  });

  return modal;
}

/**
 * Handle export button click
 */
async function handleExport() {
  const format = document.querySelector('input[name="export-format"]:checked')?.value;

  if (!format || !currentTrip) {
    return;
  }

  // Disable button while processing
  const confirmBtn = document.getElementById('confirm-export');
  confirmBtn.disabled = true;

  try {
    if (format === 'pdf') {
      await handleExportPdf();
    } else if (format === 'json') {
      await handleExportJson();
    }
    hideExportModal();
  } finally {
    confirmBtn.disabled = false;
  }
}

/**
 * Handle PDF export
 */
async function handleExportPdf() {
  try {
    showToast(t('export.generatingPdf'), 'info');

    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
    const response = await fetch(`${baseUrl}/trips/${currentTrip.id}/export/pdf`, {
      headers: {
        Authorization: `Bearer ${getItem('auth_token')}`,
      },
    });

    if (!response.ok) throw new Error('Failed to generate PDF');

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentTrip.name.replace(/[^a-z0-9]/gi, '_')}_itinerary.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    showToast(t('export.pdfSuccess'), 'success');
  } catch (error) {
    console.error('Failed to export PDF:', error);
    showToast(t('export.pdfFailed'), 'error');
  }
}

/**
 * Handle JSON export
 */
async function handleExportJson() {
  try {
    showToast(t('export.generatingJson'), 'info');

    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
    const response = await fetch(`${baseUrl}/trips/${currentTrip.id}/export/json`, {
      headers: {
        Authorization: `Bearer ${getItem('auth_token')}`,
      },
    });

    if (!response.ok) throw new Error('Failed to generate JSON');

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentTrip.name.replace(/[^a-z0-9]/gi, '_')}_trip.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    showToast(t('export.jsonSuccess'), 'success');
  } catch (error) {
    console.error('Failed to export JSON:', error);
    showToast(t('export.jsonFailed'), 'error');
  }
}
