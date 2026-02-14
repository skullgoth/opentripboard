import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/utils/i18n.js', () => ({
  t: vi.fn((key) => key),
}));

vi.mock('../../../src/utils/html.js', () => ({
  escapeHtml: vi.fn((str) => str || ''),
}));

import { confirmDialog, alertDialog } from '../../../src/utils/confirm-dialog.js';

describe('Confirm Dialog', () => {
  beforeEach(() => {
    // Remove any existing dialogs
    document.querySelectorAll('.modal-overlay').forEach((el) => el.remove());
  });

  describe('confirmDialog', () => {
    it('should create a modal overlay', () => {
      confirmDialog({ message: 'Are you sure?' });
      const overlay = document.querySelector('.modal-overlay');
      expect(overlay).toBeTruthy();
    });

    it('should set role=dialog', () => {
      confirmDialog({ message: 'Confirm?' });
      const overlay = document.querySelector('.modal-overlay');
      expect(overlay.getAttribute('role')).toBe('dialog');
    });

    it('should set aria-modal=true', () => {
      confirmDialog({ message: 'Confirm?' });
      const overlay = document.querySelector('.modal-overlay');
      expect(overlay.getAttribute('aria-modal')).toBe('true');
    });

    it('should show confirm and cancel buttons', () => {
      confirmDialog({ message: 'Confirm?' });
      const confirmBtn = document.querySelector('[data-action="confirm"]');
      const cancelBtn = document.querySelector('[data-action="cancel"]');
      expect(confirmBtn).toBeTruthy();
      expect(cancelBtn).toBeTruthy();
    });

    it('should resolve true when confirm is clicked', async () => {
      const promise = confirmDialog({ message: 'Confirm?' });
      const confirmBtn = document.querySelector('[data-action="confirm"]');
      confirmBtn.click();
      const result = await promise;
      expect(result).toBe(true);
    });

    it('should resolve false when cancel is clicked', async () => {
      const promise = confirmDialog({ message: 'Confirm?' });
      const cancelBtn = document.querySelector('[data-action="cancel"]');
      cancelBtn.click();
      const result = await promise;
      expect(result).toBe(false);
    });

    it('should use custom button text', () => {
      confirmDialog({
        message: 'Delete?',
        confirmText: 'Yes Delete',
        cancelText: 'No Keep',
      });
      const confirmBtn = document.querySelector('[data-action="confirm"]');
      const cancelBtn = document.querySelector('[data-action="cancel"]');
      expect(confirmBtn.textContent).toBe('Yes Delete');
      expect(cancelBtn.textContent).toBe('No Keep');
    });

    it('should apply danger variant class', () => {
      confirmDialog({ message: 'Delete?', variant: 'danger' });
      const confirmBtn = document.querySelector('[data-action="confirm"]');
      expect(confirmBtn.classList.contains('btn-danger')).toBe(true);
    });

    it('should apply primary variant class', () => {
      confirmDialog({ message: 'Save?', variant: 'primary' });
      const confirmBtn = document.querySelector('[data-action="confirm"]');
      expect(confirmBtn.classList.contains('btn-primary')).toBe(true);
    });
  });

  describe('alertDialog', () => {
    it('should create a modal overlay', () => {
      alertDialog({ message: 'Alert!' });
      const overlay = document.querySelector('.modal-overlay');
      expect(overlay).toBeTruthy();
    });

    it('should set role=alertdialog', () => {
      alertDialog({ message: 'Alert!' });
      const overlay = document.querySelector('.modal-overlay');
      expect(overlay.getAttribute('role')).toBe('alertdialog');
    });

    it('should show OK button', () => {
      alertDialog({ message: 'Alert!' });
      const okBtn = document.querySelector('[data-action="ok"]');
      expect(okBtn).toBeTruthy();
    });

    it('should resolve when OK is clicked', async () => {
      const promise = alertDialog({ message: 'Alert!' });
      const okBtn = document.querySelector('[data-action="ok"]');
      okBtn.click();
      await expect(promise).resolves.toBeUndefined();
    });

    it('should use custom button text', () => {
      alertDialog({ message: 'Done!', confirmText: 'Got it' });
      const okBtn = document.querySelector('[data-action="ok"]');
      expect(okBtn.textContent).toBe('Got it');
    });
  });
});
