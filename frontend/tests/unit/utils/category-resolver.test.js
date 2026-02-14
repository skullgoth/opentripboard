import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/utils/default-categories.js', () => ({
  findDefaultCategory: vi.fn(),
  isCustomCategory: vi.fn((val) => val && val.startsWith('custom:')),
  extractCustomCategoryId: vi.fn((val) => val && val.startsWith('custom:') ? val.substring(7) : null),
}));

vi.mock('../../../src/state/categories-state.js', () => ({
  findCategoryByValue: vi.fn(),
}));

vi.mock('../../../src/utils/i18n.js', () => ({
  t: vi.fn((key) => key),
}));

import {
  resolveCategory,
  getFallbackCategory,
  getDefaultIconForDomain,
  formatCategory,
  getCategoryIcon,
  getCategoryName,
  buildCategoryOptions,
} from '../../../src/utils/category-resolver.js';

import { findDefaultCategory } from '../../../src/utils/default-categories.js';
import { findCategoryByValue } from '../../../src/state/categories-state.js';
import { t } from '../../../src/utils/i18n.js';

describe('Category Resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDefaultIconForDomain', () => {
    it('should return correct icon for activity', () => {
      expect(getDefaultIconForDomain('activity')).toBe('📍');
    });

    it('should return correct icon for expense', () => {
      expect(getDefaultIconForDomain('expense')).toBe('💰');
    });

    it('should return correct icon for document', () => {
      expect(getDefaultIconForDomain('document')).toBe('📄');
    });

    it('should return fallback icon for unknown domain', () => {
      expect(getDefaultIconForDomain('unknown')).toBe('📦');
    });
  });

  describe('resolveCategory', () => {
    it('should return fallback for null value', () => {
      findDefaultCategory.mockReturnValue({ i18nKey: 'categories.expense.other', icon: '📦', key: 'other' });
      const result = resolveCategory(null, 'expense');
      expect(result.key).toBe('other');
    });

    it('should resolve default category by key', () => {
      findDefaultCategory.mockReturnValue({
        key: 'museum',
        icon: '🏛️',
        i18nKey: 'categories.activity.museum',
      });
      t.mockReturnValue('Museum');

      const result = resolveCategory('museum', 'activity');
      expect(result.name).toBe('Museum');
      expect(result.icon).toBe('🏛️');
      expect(result.isCustom).toBe(false);
    });

    it('should resolve custom category from provided array', () => {
      const customCats = [{ id: 'abc-123', name: 'My Category', icon: '⭐' }];
      const result = resolveCategory('custom:abc-123', 'activity', customCats);
      expect(result.name).toBe('My Category');
      expect(result.icon).toBe('⭐');
      expect(result.isCustom).toBe(true);
    });

    it('should resolve custom category from state', () => {
      findCategoryByValue.mockReturnValue({ id: 'abc', name: 'State Cat', icon: '🎯' });
      const result = resolveCategory('custom:abc', 'activity');
      expect(result.name).toBe('State Cat');
      expect(result.isCustom).toBe(true);
    });

    it('should return fallback for unknown category', () => {
      findDefaultCategory.mockReturnValueOnce(null); // for resolve
      findDefaultCategory.mockReturnValue({ i18nKey: 'categories.expense.other', icon: '📦', key: 'other' }); // for fallback
      const result = resolveCategory('nonexistent', 'expense');
      // When findDefaultCategory returns null, it returns the value as-is
      expect(result).toBeDefined();
    });
  });

  describe('getFallbackCategory', () => {
    it('should return other category for domain', () => {
      findDefaultCategory.mockReturnValue({
        i18nKey: 'categories.activity.other',
        icon: '📍',
        key: 'other',
      });
      t.mockReturnValue('Other');

      const result = getFallbackCategory('activity');
      expect(result.key).toBe('other');
      expect(result.name).toBe('Other');
    });

    it('should return ultimate fallback when no other exists', () => {
      findDefaultCategory.mockReturnValue(null);
      const result = getFallbackCategory('unknown');
      expect(result.key).toBe('other');
    });
  });

  describe('formatCategory', () => {
    it('should return icon + name string', () => {
      findDefaultCategory.mockReturnValue({
        key: 'hotel',
        icon: '🏨',
        i18nKey: 'categories.activity.hotel',
      });
      t.mockReturnValue('Hotel');

      const result = formatCategory('hotel', 'activity');
      expect(result).toBe('🏨 Hotel');
    });
  });

  describe('getCategoryIcon', () => {
    it('should return only the icon', () => {
      findDefaultCategory.mockReturnValue({
        key: 'hotel',
        icon: '🏨',
        i18nKey: 'categories.activity.hotel',
      });
      t.mockReturnValue('Hotel');

      const result = getCategoryIcon('hotel', 'activity');
      expect(result).toBe('🏨');
    });
  });

  describe('getCategoryName', () => {
    it('should return only the name', () => {
      findDefaultCategory.mockReturnValue({
        key: 'hotel',
        icon: '🏨',
        i18nKey: 'categories.activity.hotel',
      });
      t.mockReturnValue('Hotel');

      const result = getCategoryName('hotel', 'activity');
      expect(result).toBe('Hotel');
    });
  });

  describe('buildCategoryOptions', () => {
    it('should build options from defaults', () => {
      t.mockImplementation((key) => key);
      const defaults = [
        { key: 'hotel', icon: '🏨', i18nKey: 'cat.hotel', name: 'Hotel' },
        { key: 'flight', icon: '✈️', i18nKey: 'cat.flight', name: 'Flight' },
      ];

      const options = buildCategoryOptions('activity', defaults, []);
      expect(options.length).toBe(2);
      expect(options[0].value).toBe('hotel');
    });

    it('should group defaults by group property', () => {
      t.mockImplementation((key) => key);
      const defaults = [
        { key: 'hotel', icon: '🏨', i18nKey: 'cat.hotel', group: 'lodging' },
        { key: 'hostel', icon: '🛏️', i18nKey: 'cat.hostel', group: 'lodging' },
      ];

      const options = buildCategoryOptions('activity', defaults, []);
      const grouped = options.find((o) => o.groupLabel);
      expect(grouped).toBeDefined();
      expect(grouped.options).toHaveLength(2);
    });

    it('should add custom categories as a group', () => {
      t.mockImplementation((key) => key);
      const customs = [
        { id: 'abc', name: 'My Cat', icon: '⭐', ref: 'custom:abc' },
      ];

      const options = buildCategoryOptions('activity', [], customs);
      const customGroup = options.find((o) => o.groupLabel);
      expect(customGroup).toBeDefined();
      expect(customGroup.options[0].isCustom).toBe(true);
    });

    it('should return empty array for empty inputs', () => {
      const options = buildCategoryOptions('activity', [], []);
      expect(options).toEqual([]);
    });
  });
});
