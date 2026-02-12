// Styled confirm/alert dialog replacements using existing modal styles
import { t } from './i18n.js';
import { escapeHtml } from './html.js';

let activeDialog = null;

/**
 * Show a styled confirm dialog (OK/Cancel)
 * @param {Object} options
 * @param {string} [options.title] - Dialog title
 * @param {string} options.message - Dialog message (supports \n for line breaks)
 * @param {string} [options.confirmText] - Confirm button label
 * @param {string} [options.cancelText] - Cancel button label
 * @param {'danger'|'primary'} [options.variant='danger'] - Confirm button style
 * @returns {Promise<boolean>} true if confirmed, false if cancelled
 */
export function confirmDialog({
  title,
  message,
  confirmText,
  cancelText,
  variant = 'danger',
} = {}) {
  return new Promise((resolve) => {
    // Dismiss any existing dialog
    dismissActiveDialog();

    const confirmLabel = confirmText || t('common.confirm');
    const cancelLabel = cancelText || t('common.cancel');
    const titleText = title || t('common.confirm');
    const btnClass = variant === 'danger' ? 'btn-danger' : 'btn-primary';

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'confirm-dialog-title');

    overlay.innerHTML = `
    <div class="modal-dialog modal-dialog-sm">
      <div class="modal-header">
        <h2 class="modal-title" id="confirm-dialog-title">${escapeHtml(titleText)}</h2>
      </div>
      <div class="modal-body">
        <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-action="cancel">${escapeHtml(cancelLabel)}</button>
        <button type="button" class="btn ${btnClass}" data-action="confirm">${escapeHtml(confirmLabel)}</button>
      </div>
    </div>`;

    const cancelBtn = overlay.querySelector('[data-action="cancel"]');
    const confirmBtn = overlay.querySelector('[data-action="confirm"]');

    function close(result) {
      overlay.classList.remove('open');
      overlay.addEventListener(
        'transitionend',
        () => {
          overlay.remove();
        },
        { once: true }
      );
      // Fallback removal if transition doesn't fire
      setTimeout(() => {
        if (overlay.parentElement) overlay.remove();
      }, 300);
      activeDialog = null;
      document.removeEventListener('keydown', onKeydown);
      resolve(result);
    }

    function onKeydown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        close(false);
      }
      // Focus trap
      if (e.key === 'Tab') {
        const focusable = [cancelBtn, confirmBtn];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    cancelBtn.addEventListener('click', () => close(false));
    confirmBtn.addEventListener('click', () => close(true));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(false);
    });
    document.addEventListener('keydown', onKeydown);

    document.body.appendChild(overlay);
    activeDialog = overlay;

    requestAnimationFrame(() => {
      overlay.classList.add('open');
      cancelBtn.focus();
    });
  });
}

/**
 * Show a styled alert dialog (single OK button)
 * @param {Object} options
 * @param {string} [options.title] - Dialog title
 * @param {string} options.message - Dialog message (supports \n for line breaks)
 * @param {string} [options.confirmText] - OK button label
 * @returns {Promise<void>}
 */
export function alertDialog({
  title,
  message,
  confirmText,
} = {}) {
  return new Promise((resolve) => {
    dismissActiveDialog();

    const okLabel = confirmText || t('common.ok');
    const titleText = title || t('common.info');

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'alert-dialog-title');

    overlay.innerHTML = `
    <div class="modal-dialog modal-dialog-sm">
      <div class="modal-header">
        <h2 class="modal-title" id="alert-dialog-title">${escapeHtml(titleText)}</h2>
      </div>
      <div class="modal-body">
        <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-primary" data-action="ok">${escapeHtml(okLabel)}</button>
      </div>
    </div>`;

    const okBtn = overlay.querySelector('[data-action="ok"]');

    function close() {
      overlay.classList.remove('open');
      overlay.addEventListener(
        'transitionend',
        () => {
          overlay.remove();
        },
        { once: true }
      );
      setTimeout(() => {
        if (overlay.parentElement) overlay.remove();
      }, 300);
      activeDialog = null;
      document.removeEventListener('keydown', onKeydown);
      resolve();
    }

    function onKeydown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
      // Focus trap (single button)
      if (e.key === 'Tab') {
        e.preventDefault();
        okBtn.focus();
      }
    }

    okBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', onKeydown);

    document.body.appendChild(overlay);
    activeDialog = overlay;

    requestAnimationFrame(() => {
      overlay.classList.add('open');
      okBtn.focus();
    });
  });
}

/**
 * Dismiss any active dialog without resolving
 */
function dismissActiveDialog() {
  if (activeDialog && activeDialog.parentElement) {
    activeDialog.remove();
    activeDialog = null;
  }
}
