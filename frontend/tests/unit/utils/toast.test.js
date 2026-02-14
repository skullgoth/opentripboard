import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/utils/i18n.js', () => ({
  t: vi.fn((key) => key),
}));

vi.mock('../../../src/utils/html.js', () => ({
  escapeHtml: vi.fn((str) => str || ''),
}));

import { showToast } from '../../../src/utils/toast.js';

describe('Toast Utility', () => {
  beforeEach(() => {
    // Clean up toast container
    const container = document.getElementById('toast-container');
    if (container) container.remove();
  });

  describe('showToast', () => {
    it('should create toast container if not exists', () => {
      showToast('Test message');
      const container = document.getElementById('toast-container');
      expect(container).toBeTruthy();
    });

    it('should add toast element to container', () => {
      showToast('Test message');
      const container = document.getElementById('toast-container');
      const toasts = container.querySelectorAll('.toast');
      expect(toasts.length).toBe(1);
    });

    it('should apply correct type class', () => {
      showToast('Error!', 'error');
      const toast = document.querySelector('.toast-error');
      expect(toast).toBeTruthy();
    });

    it('should set role=alert for accessibility', () => {
      showToast('Message');
      const toast = document.querySelector('.toast');
      expect(toast.getAttribute('role')).toBe('alert');
    });

    it('should display the message', () => {
      showToast('Hello World');
      const message = document.querySelector('.toast-message');
      expect(message.textContent).toBe('Hello World');
    });

    it('should include close button', () => {
      showToast('Message');
      const closeBtn = document.querySelector('.toast-close');
      expect(closeBtn).toBeTruthy();
    });

    it('should support success type', () => {
      showToast('Success', 'success');
      const toast = document.querySelector('.toast-success');
      expect(toast).toBeTruthy();
    });

    it('should support warning type', () => {
      showToast('Warning', 'warning');
      const toast = document.querySelector('.toast-warning');
      expect(toast).toBeTruthy();
    });

    it('should support info type', () => {
      showToast('Info', 'info');
      const toast = document.querySelector('.toast-info');
      expect(toast).toBeTruthy();
    });

    it('should reuse existing toast container', () => {
      showToast('First');
      showToast('Second');
      const containers = document.querySelectorAll('#toast-container');
      expect(containers.length).toBe(1);
    });
  });
});
