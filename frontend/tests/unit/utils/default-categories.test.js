/**
 * Unit tests for Default Categories
 * Tests constants and helper functions from src/utils/default-categories.js
 */

import { describe, it, expect, vi } from 'vitest';

// Mock i18n — stub t() to return the key
vi.mock('../../../src/utils/i18n.js', () => ({
  t: (key) => key,
}));

import {
  ACTIVITY_GROUPS,
  TYPES_WITH_SPECIAL_FIELDS,
  LODGING_TYPES,
  DEFAULT_ACTIVITY_TYPES,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_DOCUMENT_TYPES,
  VALID_DOMAINS,
  MAX_CATEGORIES_PER_USER,
  isCustomCategory,
  extractCustomCategoryId,
  createCustomCategoryRef,
  findDefaultCategory,
  getCategoryIcon,
  hasSpecialFields,
  isLodgingType,
  getTypeGroup,
  getDefaultCategories,
  getOtherCategory,
} from '../../../src/utils/default-categories.js';

describe('Default Categories', () => {
  // ─── Constants ─────────────────────────────────────────────
  describe('Constants', () => {
    it('should define activity groups', () => {
      expect(Array.isArray(ACTIVITY_GROUPS)).toBe(true);
      expect(ACTIVITY_GROUPS.length).toBeGreaterThan(0);
    });

    it('should have key and i18nKey for each group', () => {
      ACTIVITY_GROUPS.forEach((group) => {
        expect(group).toHaveProperty('key');
        expect(group).toHaveProperty('i18nKey');
      });
    });

    it('should define default activity types', () => {
      expect(Array.isArray(DEFAULT_ACTIVITY_TYPES)).toBe(true);
      expect(DEFAULT_ACTIVITY_TYPES.length).toBeGreaterThan(0);
    });

    it('should have key, icon, i18nKey, and group for each activity type', () => {
      DEFAULT_ACTIVITY_TYPES.forEach((type) => {
        expect(type).toHaveProperty('key');
        expect(type).toHaveProperty('icon');
        expect(type).toHaveProperty('i18nKey');
        expect(type).toHaveProperty('group');
      });
    });

    it('should define expense categories', () => {
      expect(Array.isArray(DEFAULT_EXPENSE_CATEGORIES)).toBe(true);
      expect(DEFAULT_EXPENSE_CATEGORIES.length).toBeGreaterThan(0);
    });

    it('should define document types', () => {
      expect(Array.isArray(DEFAULT_DOCUMENT_TYPES)).toBe(true);
      expect(DEFAULT_DOCUMENT_TYPES.length).toBeGreaterThan(0);
    });

    it('should define valid domains', () => {
      expect(VALID_DOMAINS).toEqual(['activity', 'expense', 'document']);
    });

    it('should set max categories per user', () => {
      expect(MAX_CATEGORIES_PER_USER).toBe(100);
    });

    it('should include lodging types in special fields list', () => {
      LODGING_TYPES.forEach((type) => {
        expect(TYPES_WITH_SPECIAL_FIELDS).toContain(type);
      });
    });

    it('should include restaurant, bar, cafe in special fields', () => {
      expect(TYPES_WITH_SPECIAL_FIELDS).toContain('restaurant');
      expect(TYPES_WITH_SPECIAL_FIELDS).toContain('bar');
      expect(TYPES_WITH_SPECIAL_FIELDS).toContain('cafe');
    });
  });

  // ─── isCustomCategory ──────────────────────────────────────
  describe('isCustomCategory', () => {
    it('should return true for custom: prefix', () => {
      expect(isCustomCategory('custom:abc-123')).toBe(true);
    });

    it('should return false for default category key', () => {
      expect(isCustomCategory('museum')).toBe(false);
    });

    it('should return falsy for null', () => {
      expect(isCustomCategory(null)).toBeFalsy();
    });

    it('should return falsy for undefined', () => {
      expect(isCustomCategory(undefined)).toBeFalsy();
    });

    it('should return falsy for empty string', () => {
      expect(isCustomCategory('')).toBeFalsy();
    });
  });

  // ─── extractCustomCategoryId ───────────────────────────────
  describe('extractCustomCategoryId', () => {
    it('should extract UUID from custom category ref', () => {
      expect(extractCustomCategoryId('custom:abc-123')).toBe('abc-123');
    });

    it('should return null for non-custom category', () => {
      expect(extractCustomCategoryId('museum')).toBeNull();
    });

    it('should return null for null input', () => {
      expect(extractCustomCategoryId(null)).toBeNull();
    });

    it('should extract empty string when just prefix', () => {
      expect(extractCustomCategoryId('custom:')).toBe('');
    });
  });

  // ─── createCustomCategoryRef ───────────────────────────────
  describe('createCustomCategoryRef', () => {
    it('should create a custom category reference', () => {
      expect(createCustomCategoryRef('abc-123')).toBe('custom:abc-123');
    });

    it('should roundtrip with extractCustomCategoryId', () => {
      const uuid = 'some-uuid-value';
      const ref = createCustomCategoryRef(uuid);
      expect(extractCustomCategoryId(ref)).toBe(uuid);
    });
  });

  // ─── findDefaultCategory ───────────────────────────────────
  describe('findDefaultCategory', () => {
    it('should find museum in activity domain', () => {
      const category = findDefaultCategory('activity', 'museum');
      expect(category).not.toBeNull();
      expect(category.id).toBe('museum');
    });

    it('should find accommodation in expense domain', () => {
      const category = findDefaultCategory('expense', 'accommodation');
      expect(category).not.toBeNull();
      expect(category.id).toBe('accommodation');
    });

    it('should find passport in document domain', () => {
      const category = findDefaultCategory('document', 'passport');
      expect(category).not.toBeNull();
      expect(category.id).toBe('passport');
    });

    it('should return null for unknown key', () => {
      expect(findDefaultCategory('activity', 'nonexistent')).toBeNull();
    });

    it('should return null for unknown domain', () => {
      expect(findDefaultCategory('invalid', 'museum')).toBeNull();
    });
  });

  // ─── getCategoryIcon ───────────────────────────────────────
  describe('getCategoryIcon', () => {
    it('should return icon for known category', () => {
      const icon = getCategoryIcon('activity', 'museum');
      expect(icon).toBe('🏛️');
    });

    it('should return default icon for unknown category', () => {
      const icon = getCategoryIcon('activity', 'nonexistent');
      expect(icon).toBe('📁');
    });

    it('should return default icon for unknown domain', () => {
      const icon = getCategoryIcon('invalid', 'museum');
      expect(icon).toBe('📁');
    });
  });

  // ─── hasSpecialFields ──────────────────────────────────────
  describe('hasSpecialFields', () => {
    it('should return true for hotel', () => {
      expect(hasSpecialFields('hotel')).toBe(true);
    });

    it('should return true for restaurant', () => {
      expect(hasSpecialFields('restaurant')).toBe(true);
    });

    it('should return true for cafe', () => {
      expect(hasSpecialFields('cafe')).toBe(true);
    });

    it('should return false for museum', () => {
      expect(hasSpecialFields('museum')).toBe(false);
    });

    it('should return false for unknown type', () => {
      expect(hasSpecialFields('nonexistent')).toBe(false);
    });
  });

  // ─── isLodgingType ─────────────────────────────────────────
  describe('isLodgingType', () => {
    it('should return true for hotel', () => {
      expect(isLodgingType('hotel')).toBe(true);
    });

    it('should return true for rental', () => {
      expect(isLodgingType('rental')).toBe(true);
    });

    it('should return true for hostel', () => {
      expect(isLodgingType('hostel')).toBe(true);
    });

    it('should return true for camping', () => {
      expect(isLodgingType('camping')).toBe(true);
    });

    it('should return true for resort', () => {
      expect(isLodgingType('resort')).toBe(true);
    });

    it('should return false for restaurant', () => {
      expect(isLodgingType('restaurant')).toBe(false);
    });

    it('should return false for museum', () => {
      expect(isLodgingType('museum')).toBe(false);
    });
  });

  // ─── getTypeGroup ──────────────────────────────────────────
  describe('getTypeGroup', () => {
    it('should return culture for museum', () => {
      expect(getTypeGroup('museum')).toBe('culture');
    });

    it('should return nature for park', () => {
      expect(getTypeGroup('park')).toBe('nature');
    });

    it('should return lodging for hotel', () => {
      expect(getTypeGroup('hotel')).toBe('lodging');
    });

    it('should return transport for airport', () => {
      expect(getTypeGroup('airport')).toBe('transport');
    });

    it('should return dining for restaurant', () => {
      expect(getTypeGroup('restaurant')).toBe('dining');
    });

    it('should return null for unknown type', () => {
      expect(getTypeGroup('nonexistent')).toBeNull();
    });
  });

  // ─── getDefaultCategories ──────────────────────────────────
  describe('getDefaultCategories', () => {
    it('should return categories for all domains', () => {
      const defaults = getDefaultCategories();
      expect(defaults).toHaveProperty('activity');
      expect(defaults).toHaveProperty('expense');
      expect(defaults).toHaveProperty('document');
    });

    it('should include id, name, icon, domain for each category', () => {
      const defaults = getDefaultCategories();
      defaults.activity.forEach((cat) => {
        expect(cat).toHaveProperty('id');
        expect(cat).toHaveProperty('name');
        expect(cat).toHaveProperty('icon');
        expect(cat).toHaveProperty('domain');
        expect(cat.domain).toBe('activity');
      });
    });

    it('should mark activity categories as not custom', () => {
      const defaults = getDefaultCategories();
      defaults.activity.forEach((cat) => {
        expect(cat.isCustom).toBe(false);
      });
    });

    it('should include group for activity categories', () => {
      const defaults = getDefaultCategories();
      defaults.activity.forEach((cat) => {
        expect(cat).toHaveProperty('group');
      });
    });
  });

  // ─── getOtherCategory ──────────────────────────────────────
  describe('getOtherCategory', () => {
    it('should return other category for activity domain', () => {
      const other = getOtherCategory('activity');
      expect(other).not.toBeNull();
      expect(other.id).toBe('other');
    });

    it('should return other category for expense domain', () => {
      const other = getOtherCategory('expense');
      expect(other).not.toBeNull();
      expect(other.id).toBe('other');
    });

    it('should return other category for document domain', () => {
      const other = getOtherCategory('document');
      expect(other).not.toBeNull();
      expect(other.id).toBe('other');
    });

    it('should return null for unknown domain', () => {
      expect(getOtherCategory('invalid')).toBeNull();
    });
  });
});
