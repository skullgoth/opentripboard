/**
 * Unit tests for Categories State Management
 * Tests state functions from src/state/categories-state.js
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDefaults = {
  activity: [
    { key: 'museum', name: 'Museum', icon: '🏛️', i18nKey: 'categories.activity.museum' },
    { key: 'hiking', name: 'Hiking', icon: '🥾', i18nKey: 'categories.activity.hiking' },
  ],
  expense: [
    { key: 'food', name: 'Food', icon: '🍔', i18nKey: 'categories.expense.food' },
  ],
  document: [
    { key: 'passport', name: 'Passport', icon: '📄', i18nKey: 'categories.document.passport' },
  ],
};

vi.mock('../../../src/utils/default-categories.js', () => ({
  getDefaultCategories: vi.fn(() => ({
    activity: [
      { key: 'museum', name: 'Museum', icon: '🏛️', i18nKey: 'categories.activity.museum' },
      { key: 'hiking', name: 'Hiking', icon: '🥾', i18nKey: 'categories.activity.hiking' },
    ],
    expense: [
      { key: 'food', name: 'Food', icon: '🍔', i18nKey: 'categories.expense.food' },
    ],
    document: [
      { key: 'passport', name: 'Passport', icon: '📄', i18nKey: 'categories.document.passport' },
    ],
  })),
}));

vi.mock('../../../src/utils/i18n.js', () => ({
  onLanguageChange: vi.fn(),
  isI18nLoaded: vi.fn(() => false),
}));

let mod;

describe('Categories State', () => {
  beforeEach(async () => {
    vi.resetModules();

    vi.mock('../../../src/utils/default-categories.js', () => ({
      getDefaultCategories: vi.fn(() => ({
        activity: [
          { key: 'museum', name: 'Museum', icon: '🏛️', i18nKey: 'categories.activity.museum' },
          { key: 'hiking', name: 'Hiking', icon: '🥾', i18nKey: 'categories.activity.hiking' },
        ],
        expense: [
          { key: 'food', name: 'Food', icon: '🍔', i18nKey: 'categories.expense.food' },
        ],
        document: [
          {
            key: 'passport',
            name: 'Passport',
            icon: '📄',
            i18nKey: 'categories.document.passport',
          },
        ],
      })),
    }));

    vi.mock('../../../src/utils/i18n.js', () => ({
      onLanguageChange: vi.fn(),
      isI18nLoaded: vi.fn(() => false),
    }));

    mod = await import('../../../src/state/categories-state.js');
  });

  // ─── getCategories ────────────────────────────────────────
  describe('getCategories', () => {
    it('should return defaults and custom categories', () => {
      const cats = mod.getCategories();
      expect(cats).toHaveProperty('defaults');
      expect(cats).toHaveProperty('custom');
      expect(cats.defaults.activity).toHaveLength(2);
      expect(cats.defaults.expense).toHaveLength(1);
      expect(cats.defaults.document).toHaveLength(1);
    });

    it('should return empty custom categories initially', () => {
      const cats = mod.getCategories();
      expect(cats.custom.activity).toEqual([]);
      expect(cats.custom.expense).toEqual([]);
      expect(cats.custom.document).toEqual([]);
    });

    it('should return copies, not references', () => {
      const cats1 = mod.getCategories();
      const cats2 = mod.getCategories();
      expect(cats1).not.toBe(cats2);
      expect(cats1.defaults).not.toBe(cats2.defaults);
    });
  });

  // ─── getCategoriesByDomain ────────────────────────────────
  describe('getCategoriesByDomain', () => {
    it('should return defaults and custom for a specific domain', () => {
      const result = mod.getCategoriesByDomain('activity');
      expect(result.defaults).toHaveLength(2);
      expect(result.custom).toEqual([]);
    });

    it('should return empty arrays for unknown domain', () => {
      const result = mod.getCategoriesByDomain('nonexistent');
      expect(result.defaults).toEqual([]);
      expect(result.custom).toEqual([]);
    });
  });

  // ─── getAllCategoriesForDomain ─────────────────────────────
  describe('getAllCategoriesForDomain', () => {
    it('should return flat array with isCustom flag for defaults', () => {
      const result = mod.getAllCategoriesForDomain('activity');
      expect(result).toHaveLength(2);
      expect(result[0].isCustom).toBe(false);
      expect(result[0].value).toBe('museum');
      expect(result[1].value).toBe('hiking');
    });

    it('should include custom categories with isCustom true', () => {
      mod.addCustomCategory({
        id: 'c1',
        domain: 'activity',
        name: 'Custom Act',
        icon: '🎯',
        ref: 'custom:c1',
      });

      const result = mod.getAllCategoriesForDomain('activity');
      expect(result).toHaveLength(3);
      expect(result[2].isCustom).toBe(true);
      expect(result[2].value).toBe('custom:c1');
    });

    it('should return empty array for unknown domain', () => {
      const result = mod.getAllCategoriesForDomain('nonexistent');
      expect(result).toEqual([]);
    });
  });

  // ─── getCustomCategories ──────────────────────────────────
  describe('getCustomCategories', () => {
    it('should return empty custom categories initially', () => {
      const custom = mod.getCustomCategories();
      expect(custom.activity).toEqual([]);
      expect(custom.expense).toEqual([]);
      expect(custom.document).toEqual([]);
    });

    it('should return a copy, not a reference', () => {
      const custom1 = mod.getCustomCategories();
      const custom2 = mod.getCustomCategories();
      expect(custom1).not.toBe(custom2);
    });
  });

  // ─── getCustomCategoriesCount ─────────────────────────────
  describe('getCustomCategoriesCount', () => {
    it('should return 0 initially', () => {
      expect(mod.getCustomCategoriesCount()).toBe(0);
    });

    it('should count across all domains', () => {
      mod.addCustomCategory({ id: 'c1', domain: 'activity', name: 'A', icon: '🎯', ref: 'custom:c1' });
      mod.addCustomCategory({ id: 'c2', domain: 'expense', name: 'B', icon: '💰', ref: 'custom:c2' });
      mod.addCustomCategory({ id: 'c3', domain: 'expense', name: 'C', icon: '💳', ref: 'custom:c3' });

      expect(mod.getCustomCategoriesCount()).toBe(3);
    });
  });

  // ─── setCategories ────────────────────────────────────────
  describe('setCategories', () => {
    it('should set custom categories', () => {
      const customCats = {
        activity: [{ id: 'c1', name: 'Custom', icon: '🎯' }],
        expense: [],
        document: [],
      };

      mod.setCategories({ custom: customCats });

      const cats = mod.getCustomCategories();
      expect(cats.activity).toHaveLength(1);
      expect(cats.activity[0].name).toBe('Custom');
    });

    it('should mark categories as loaded', () => {
      expect(mod.isCategoriesLoaded()).toBe(false);
      mod.setCategories({ custom: { activity: [], expense: [], document: [] } });
      expect(mod.isCategoriesLoaded()).toBe(true);
    });

    it('should set defaults if provided', () => {
      const newDefaults = {
        activity: [{ key: 'new', name: 'New', icon: '🆕' }],
        expense: [],
        document: [],
      };

      mod.setCategories({ defaults: newDefaults });

      const cats = mod.getCategories();
      expect(cats.defaults.activity).toHaveLength(1);
      expect(cats.defaults.activity[0].key).toBe('new');
    });

    it('should notify subscribers', () => {
      const callback = vi.fn();
      mod.subscribeToCategories(callback);

      mod.setCategories({ custom: { activity: [], expense: [], document: [] } });

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  // ─── addCustomCategory ────────────────────────────────────
  describe('addCustomCategory', () => {
    it('should add a custom category to the correct domain', () => {
      mod.addCustomCategory({
        id: 'c1',
        domain: 'activity',
        name: 'Kayaking',
        icon: '🛶',
        ref: 'custom:c1',
      });

      const custom = mod.getCustomCategories();
      expect(custom.activity).toHaveLength(1);
      expect(custom.activity[0].name).toBe('Kayaking');
    });

    it('should create domain array if it does not exist', () => {
      mod.addCustomCategory({
        id: 'c1',
        domain: 'newdomain',
        name: 'New',
        icon: '🆕',
        ref: 'custom:c1',
      });

      const custom = mod.getCustomCategories();
      expect(custom.newdomain).toHaveLength(1);
    });

    it('should notify subscribers', () => {
      const callback = vi.fn();
      mod.subscribeToCategories(callback);

      mod.addCustomCategory({
        id: 'c1',
        domain: 'activity',
        name: 'A',
        icon: '🎯',
        ref: 'custom:c1',
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  // ─── updateCustomCategory ─────────────────────────────────
  describe('updateCustomCategory', () => {
    it('should update matching category by id', () => {
      mod.addCustomCategory({
        id: 'c1',
        domain: 'activity',
        name: 'Old Name',
        icon: '🎯',
        ref: 'custom:c1',
      });

      mod.updateCustomCategory('c1', { name: 'New Name' });

      const custom = mod.getCustomCategories();
      expect(custom.activity[0].name).toBe('New Name');
      expect(custom.activity[0].icon).toBe('🎯');
    });

    it('should do nothing if category not found', () => {
      const callback = vi.fn();
      mod.subscribeToCategories(callback);

      mod.updateCustomCategory('nonexistent', { name: 'X' });

      // Still notifies even if not found (by design)
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should notify subscribers', () => {
      mod.addCustomCategory({
        id: 'c1',
        domain: 'expense',
        name: 'Old',
        icon: '💰',
        ref: 'custom:c1',
      });

      const callback = vi.fn();
      mod.subscribeToCategories(callback);

      mod.updateCustomCategory('c1', { name: 'Updated' });

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  // ─── removeCustomCategory ─────────────────────────────────
  describe('removeCustomCategory', () => {
    it('should remove matching category by id', () => {
      mod.addCustomCategory({
        id: 'c1',
        domain: 'activity',
        name: 'To Remove',
        icon: '🗑️',
        ref: 'custom:c1',
      });

      mod.removeCustomCategory('c1');

      const custom = mod.getCustomCategories();
      expect(custom.activity).toHaveLength(0);
    });

    it('should only remove the specified category', () => {
      mod.addCustomCategory({
        id: 'c1',
        domain: 'activity',
        name: 'Keep',
        icon: '✅',
        ref: 'custom:c1',
      });
      mod.addCustomCategory({
        id: 'c2',
        domain: 'activity',
        name: 'Remove',
        icon: '🗑️',
        ref: 'custom:c2',
      });

      mod.removeCustomCategory('c2');

      const custom = mod.getCustomCategories();
      expect(custom.activity).toHaveLength(1);
      expect(custom.activity[0].id).toBe('c1');
    });

    it('should notify subscribers', () => {
      mod.addCustomCategory({
        id: 'c1',
        domain: 'activity',
        name: 'A',
        icon: '🎯',
        ref: 'custom:c1',
      });

      const callback = vi.fn();
      mod.subscribeToCategories(callback);

      mod.removeCustomCategory('c1');
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  // ─── findCategoryByValue ──────────────────────────────────
  describe('findCategoryByValue', () => {
    it('should find a default category by key', () => {
      // Ensure defaults are loaded first
      mod.getCategories();
      const result = mod.findCategoryByValue('museum', 'activity');
      expect(result).not.toBeNull();
      expect(result.key).toBe('museum');
    });

    it('should find a custom category by custom:id ref', () => {
      mod.addCustomCategory({
        id: 'c1',
        domain: 'activity',
        name: 'Custom Act',
        icon: '🎯',
        ref: 'custom:c1',
      });

      const result = mod.findCategoryByValue('custom:c1', 'activity');
      expect(result).not.toBeNull();
      expect(result.id).toBe('c1');
    });

    it('should return null when not found', () => {
      // Ensure defaults are loaded first
      mod.getCategories();
      const result = mod.findCategoryByValue('nonexistent', 'activity');
      expect(result).toBeNull();
    });

    it('should return null for custom value that does not exist', () => {
      mod.getCategories();
      const result = mod.findCategoryByValue('custom:nonexistent', 'activity');
      expect(result).toBeNull();
    });
  });

  // ─── isCategoriesLoaded / setCategoriesLoading ─────────────
  describe('isCategoriesLoaded / setCategoriesLoading', () => {
    it('should return false initially for isLoaded', () => {
      expect(mod.isCategoriesLoaded()).toBe(false);
    });

    it('should return false initially for isLoading', () => {
      expect(mod.isCategoriesLoading()).toBe(false);
    });

    it('should set loading state', () => {
      mod.setCategoriesLoading(true);
      expect(mod.isCategoriesLoading()).toBe(true);

      mod.setCategoriesLoading(false);
      expect(mod.isCategoriesLoading()).toBe(false);
    });
  });

  // ─── subscribeToCategories ────────────────────────────────
  describe('subscribeToCategories', () => {
    it('should return an unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = mod.subscribeToCategories(callback);

      mod.addCustomCategory({
        id: 'c1',
        domain: 'activity',
        name: 'A',
        icon: '🎯',
        ref: 'custom:c1',
      });
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
      mod.addCustomCategory({
        id: 'c2',
        domain: 'activity',
        name: 'B',
        icon: '🎯',
        ref: 'custom:c2',
      });
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should support multiple subscribers', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      mod.subscribeToCategories(cb1);
      mod.subscribeToCategories(cb2);

      mod.setCategories({ custom: { activity: [], expense: [], document: [] } });

      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });

    it('should not crash if subscriber throws', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const errorCb = vi.fn(() => {
        throw new Error('subscriber error');
      });
      const normalCb = vi.fn();

      mod.subscribeToCategories(errorCb);
      mod.subscribeToCategories(normalCb);

      expect(() => {
        mod.setCategories({ custom: { activity: [], expense: [], document: [] } });
      }).not.toThrow();

      expect(normalCb).toHaveBeenCalledTimes(1);

      console.error.mockRestore();
    });

    it('should pass new and old state to subscribers', () => {
      const callback = vi.fn();
      mod.subscribeToCategories(callback);

      mod.setCategories({
        custom: {
          activity: [{ id: 'c1', name: 'New' }],
          expense: [],
          document: [],
        },
      });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ custom: expect.any(Object) }),
        expect.objectContaining({ custom: expect.any(Object) }),
      );
    });
  });

  // ─── resetCategories ──────────────────────────────────────
  describe('resetCategories', () => {
    it('should reset custom categories to empty arrays', () => {
      mod.addCustomCategory({
        id: 'c1',
        domain: 'activity',
        name: 'A',
        icon: '🎯',
        ref: 'custom:c1',
      });

      mod.resetCategories();

      const custom = mod.getCustomCategories();
      expect(custom.activity).toEqual([]);
      expect(custom.expense).toEqual([]);
      expect(custom.document).toEqual([]);
    });

    it('should set isLoaded back to false', () => {
      mod.setCategories({ custom: { activity: [], expense: [], document: [] } });
      expect(mod.isCategoriesLoaded()).toBe(true);

      mod.resetCategories();
      expect(mod.isCategoriesLoaded()).toBe(false);
    });

    it('should clear trip categories cache', () => {
      mod.cacheTripCategories('trip1', { activity: [] });
      expect(mod.getTripCategoriesFromCache('trip1')).not.toBeNull();

      mod.resetCategories();
      expect(mod.getTripCategoriesFromCache('trip1')).toBeNull();
    });

    it('should notify subscribers', () => {
      const callback = vi.fn();
      mod.subscribeToCategories(callback);

      mod.resetCategories();
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Trip categories cache ────────────────────────────────
  describe('cacheTripCategories / getTripCategoriesFromCache / clearTripCategoriesCache', () => {
    it('should return null for uncached trip', () => {
      expect(mod.getTripCategoriesFromCache('trip1')).toBeNull();
    });

    it('should cache and retrieve trip categories', () => {
      const cats = { activity: [{ key: 'museum' }], expense: [] };
      mod.cacheTripCategories('trip1', cats);

      expect(mod.getTripCategoriesFromCache('trip1')).toEqual(cats);
    });

    it('should clear specific trip cache', () => {
      mod.cacheTripCategories('trip1', { activity: [] });
      mod.cacheTripCategories('trip2', { expense: [] });

      mod.clearTripCategoriesCache('trip1');

      expect(mod.getTripCategoriesFromCache('trip1')).toBeNull();
      expect(mod.getTripCategoriesFromCache('trip2')).not.toBeNull();
    });

    it('should clear all trip caches when no id provided', () => {
      mod.cacheTripCategories('trip1', { activity: [] });
      mod.cacheTripCategories('trip2', { expense: [] });

      mod.clearTripCategoriesCache();

      expect(mod.getTripCategoriesFromCache('trip1')).toBeNull();
      expect(mod.getTripCategoriesFromCache('trip2')).toBeNull();
    });
  });

  // ─── refreshDefaultCategories ─────────────────────────────
  describe('refreshDefaultCategories', () => {
    it('should refresh defaults from getDefaultCategories', () => {
      mod.refreshDefaultCategories();

      const cats = mod.getCategories();
      expect(cats.defaults.activity).toHaveLength(2);
    });

    it('should notify subscribers', () => {
      const callback = vi.fn();
      mod.subscribeToCategories(callback);

      mod.refreshDefaultCategories();
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  // ─── categoriesState facade ───────────────────────────────
  describe('categoriesState facade object', () => {
    it('should expose all methods via the facade', () => {
      const facade = mod.categoriesState;
      expect(typeof facade.get).toBe('function');
      expect(typeof facade.getByDomain).toBe('function');
      expect(typeof facade.getAllForDomain).toBe('function');
      expect(typeof facade.getCustom).toBe('function');
      expect(typeof facade.getCustomCount).toBe('function');
      expect(typeof facade.set).toBe('function');
      expect(typeof facade.addCustom).toBe('function');
      expect(typeof facade.updateCustom).toBe('function');
      expect(typeof facade.removeCustom).toBe('function');
      expect(typeof facade.findByValue).toBe('function');
      expect(typeof facade.isLoaded).toBe('function');
      expect(typeof facade.isLoading).toBe('function');
      expect(typeof facade.setLoading).toBe('function');
      expect(typeof facade.subscribe).toBe('function');
      expect(typeof facade.reset).toBe('function');
      expect(typeof facade.getTripCache).toBe('function');
      expect(typeof facade.setTripCache).toBe('function');
      expect(typeof facade.clearTripCache).toBe('function');
    });
  });
});
