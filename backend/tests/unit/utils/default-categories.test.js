import { describe, it, expect } from 'vitest';
import {
  ACTIVITY_GROUPS,
  TYPES_WITH_SPECIAL_FIELDS,
  LODGING_TYPES,
  DEFAULT_ACTIVITY_TYPES,
  DEFAULT_RESERVATION_TYPES,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_DOCUMENT_TYPES,
  VALID_DOMAINS,
  MAX_CATEGORIES_PER_USER,
  getDefaultCategories,
  isCustomCategory,
  extractCustomCategoryId,
  createCustomCategoryRef,
  getOtherCategory,
  getDefaultCategoriesByDomain,
  findDefaultCategory,
  hasSpecialFields,
  isLodgingType,
  getTypeGroup,
} from '../../../src/utils/default-categories.js';

describe('Default Categories', () => {
  describe('constants', () => {
    it('should define activity groups', () => {
      expect(ACTIVITY_GROUPS).toBeInstanceOf(Array);
      expect(ACTIVITY_GROUPS.length).toBeGreaterThan(0);
      expect(ACTIVITY_GROUPS[0]).toHaveProperty('key');
      expect(ACTIVITY_GROUPS[0]).toHaveProperty('i18nKey');
    });

    it('should define types with special fields', () => {
      expect(TYPES_WITH_SPECIAL_FIELDS).toContain('hotel');
      expect(TYPES_WITH_SPECIAL_FIELDS).toContain('restaurant');
      expect(TYPES_WITH_SPECIAL_FIELDS).toContain('bar');
      expect(TYPES_WITH_SPECIAL_FIELDS).toContain('cafe');
    });

    it('should define lodging types', () => {
      expect(LODGING_TYPES).toContain('hotel');
      expect(LODGING_TYPES).toContain('rental');
      expect(LODGING_TYPES).toContain('hostel');
      expect(LODGING_TYPES).toContain('camping');
      expect(LODGING_TYPES).toContain('resort');
    });

    it('should define activity types with required fields', () => {
      DEFAULT_ACTIVITY_TYPES.forEach((type) => {
        expect(type).toHaveProperty('key');
        expect(type).toHaveProperty('icon');
        expect(type).toHaveProperty('i18nKey');
        expect(type).toHaveProperty('group');
      });
    });

    it('should define expense categories', () => {
      expect(DEFAULT_EXPENSE_CATEGORIES.length).toBeGreaterThan(0);
      DEFAULT_EXPENSE_CATEGORIES.forEach((cat) => {
        expect(cat).toHaveProperty('key');
        expect(cat).toHaveProperty('icon');
        expect(cat).toHaveProperty('i18nKey');
      });
    });

    it('should define document types', () => {
      expect(DEFAULT_DOCUMENT_TYPES.length).toBeGreaterThan(0);
      DEFAULT_DOCUMENT_TYPES.forEach((type) => {
        expect(type).toHaveProperty('key');
        expect(type).toHaveProperty('icon');
        expect(type).toHaveProperty('i18nKey');
      });
    });

    it('should define valid domains', () => {
      expect(VALID_DOMAINS).toContain('activity');
      expect(VALID_DOMAINS).toContain('expense');
      expect(VALID_DOMAINS).toContain('document');
    });

    it('should set MAX_CATEGORIES_PER_USER to 100', () => {
      expect(MAX_CATEGORIES_PER_USER).toBe(100);
    });

    it('should have DEFAULT_RESERVATION_TYPES as filtered activity types', () => {
      expect(DEFAULT_RESERVATION_TYPES).toBeInstanceOf(Array);
      DEFAULT_RESERVATION_TYPES.forEach((type) => {
        expect(type.hasSpecialFields).toBe(true);
      });
    });
  });

  describe('getDefaultCategories', () => {
    it('should return categories for all domains', () => {
      const categories = getDefaultCategories();
      expect(categories).toHaveProperty('activity');
      expect(categories).toHaveProperty('expense');
      expect(categories).toHaveProperty('document');
    });

    it('should return activity categories with correct shape', () => {
      const categories = getDefaultCategories();
      const activity = categories.activity[0];
      expect(activity).toHaveProperty('id');
      expect(activity).toHaveProperty('name');
      expect(activity).toHaveProperty('icon');
      expect(activity).toHaveProperty('domain', 'activity');
      expect(activity).toHaveProperty('isCustom', false);
      expect(activity).toHaveProperty('group');
    });

    it('should return expense categories with correct domain', () => {
      const categories = getDefaultCategories();
      categories.expense.forEach((cat) => {
        expect(cat.domain).toBe('expense');
        expect(cat.isCustom).toBe(false);
      });
    });
  });

  describe('isCustomCategory', () => {
    it('should return true for custom: prefixed values', () => {
      expect(isCustomCategory('custom:abc-123')).toBe(true);
    });

    it('should return false for non-custom values', () => {
      expect(isCustomCategory('hotel')).toBe(false);
    });

    it('should return false for null', () => {
      expect(isCustomCategory(null)).toBeFalsy();
    });

    it('should return false for empty string', () => {
      expect(isCustomCategory('')).toBeFalsy();
    });
  });

  describe('extractCustomCategoryId', () => {
    it('should extract UUID from custom category ref', () => {
      expect(extractCustomCategoryId('custom:abc-123')).toBe('abc-123');
    });

    it('should return null for non-custom value', () => {
      expect(extractCustomCategoryId('hotel')).toBeNull();
    });

    it('should return null for null input', () => {
      expect(extractCustomCategoryId(null)).toBeNull();
    });
  });

  describe('createCustomCategoryRef', () => {
    it('should create custom: prefixed ref', () => {
      expect(createCustomCategoryRef('abc-123')).toBe('custom:abc-123');
    });
  });

  describe('getOtherCategory', () => {
    it('should return other category for activity domain', () => {
      const other = getOtherCategory('activity');
      expect(other).toBeDefined();
      expect(other.id).toBe('other');
    });

    it('should return other category for expense domain', () => {
      const other = getOtherCategory('expense');
      expect(other).toBeDefined();
      expect(other.id).toBe('other');
    });

    it('should return null for invalid domain', () => {
      expect(getOtherCategory('invalid')).toBeNull();
    });
  });

  describe('getDefaultCategoriesByDomain', () => {
    it('should return activity categories', () => {
      const cats = getDefaultCategoriesByDomain('activity');
      expect(cats.length).toBeGreaterThan(0);
      expect(cats[0].domain).toBe('activity');
    });

    it('should return empty array for invalid domain', () => {
      expect(getDefaultCategoriesByDomain('invalid')).toEqual([]);
    });
  });

  describe('findDefaultCategory', () => {
    it('should find museum in activity domain', () => {
      const cat = findDefaultCategory('activity', 'museum');
      expect(cat).toBeDefined();
      expect(cat.id).toBe('museum');
    });

    it('should return null for non-existent key', () => {
      expect(findDefaultCategory('activity', 'nonexistent')).toBeNull();
    });
  });

  describe('hasSpecialFields', () => {
    it('should return true for hotel', () => {
      expect(hasSpecialFields('hotel')).toBe(true);
    });

    it('should return true for restaurant', () => {
      expect(hasSpecialFields('restaurant')).toBe(true);
    });

    it('should return false for museum', () => {
      expect(hasSpecialFields('museum')).toBe(false);
    });
  });

  describe('isLodgingType', () => {
    it('should return true for hotel', () => {
      expect(isLodgingType('hotel')).toBe(true);
    });

    it('should return true for camping', () => {
      expect(isLodgingType('camping')).toBe(true);
    });

    it('should return false for restaurant', () => {
      expect(isLodgingType('restaurant')).toBe(false);
    });
  });

  describe('getTypeGroup', () => {
    it('should return culture for museum', () => {
      expect(getTypeGroup('museum')).toBe('culture');
    });

    it('should return lodging for hotel', () => {
      expect(getTypeGroup('hotel')).toBe('lodging');
    });

    it('should return null for unknown type', () => {
      expect(getTypeGroup('nonexistent')).toBeNull();
    });
  });
});
