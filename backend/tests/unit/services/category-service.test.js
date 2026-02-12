/**
 * Unit tests for Category Service
 * Tests all category-related business logic including CRUD, validation, and resolution
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as categoryService from '../../../src/services/category-service.js';
import * as categoryQueries from '../../../src/db/queries/categories.js';
import * as defaultCategories from '../../../src/utils/default-categories.js';

// Mock the database connection and queries
vi.mock('../../../src/db/connection.js', () => ({
  getPool: vi.fn(),
  query: vi.fn(),
  getClient: vi.fn(),
  closePool: vi.fn(),
  testConnection: vi.fn(),
}));

// Mock categories queries, keeping real values for constants
vi.mock('../../../src/db/queries/categories.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getUserCategories: vi.fn(),
    getUserCategoriesByDomain: vi.fn(),
    getCategoryById: vi.fn(),
    countUserCategories: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
    deleteCategoryWithReassignment: vi.fn(),
    getCategoryUsageCount: vi.fn(),
    reassignCategoryToOther: vi.fn(),
    validateCategory: vi.fn(),
  };
});

vi.mock('../../../src/utils/default-categories.js');

describe('Category Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCategories', () => {
    const userId = 'user-123';

    it('should return defaults and custom categories organized by domain', async () => {
      const mockCustomCategories = [
        { id: 'cat-1', name: 'Scuba', icon: '🤿', domain: 'activity' },
        { id: 'cat-2', name: 'Taxi', icon: '🚕', domain: 'expense' },
      ];
      const mockDefaults = {
        activity: [{ key: 'museum', icon: '🏛️' }],
        expense: [{ key: 'food', icon: '🍔' }],
      };

      vi.mocked(categoryQueries.getUserCategories).mockResolvedValue(mockCustomCategories);
      vi.mocked(defaultCategories.getDefaultCategories).mockReturnValue(mockDefaults);

      const result = await categoryService.getCategories(userId);

      expect(result.defaults).toEqual(mockDefaults);
      expect(result.custom.activity).toHaveLength(1);
      expect(result.custom.activity[0].name).toBe('Scuba');
      expect(result.custom.activity[0].isCustom).toBe(true);
      expect(result.custom.expense).toHaveLength(1);
      expect(result.custom.expense[0].name).toBe('Taxi');
      expect(result.custom.document).toHaveLength(0);
    });

    it('should return empty custom arrays when user has no custom categories', async () => {
      vi.mocked(categoryQueries.getUserCategories).mockResolvedValue([]);
      vi.mocked(defaultCategories.getDefaultCategories).mockReturnValue({});

      const result = await categoryService.getCategories(userId);

      expect(result.custom.activity).toHaveLength(0);
      expect(result.custom.expense).toHaveLength(0);
      expect(result.custom.document).toHaveLength(0);
    });

    it('should skip categories with unknown domains', async () => {
      const mockCustomCategories = [
        { id: 'cat-1', name: 'Test', icon: '📋', domain: 'unknownDomain' },
      ];

      vi.mocked(categoryQueries.getUserCategories).mockResolvedValue(mockCustomCategories);
      vi.mocked(defaultCategories.getDefaultCategories).mockReturnValue({});

      const result = await categoryService.getCategories(userId);

      expect(result.custom.activity).toHaveLength(0);
      expect(result.custom.expense).toHaveLength(0);
      expect(result.custom.document).toHaveLength(0);
    });
  });

  describe('getCategoriesByDomain', () => {
    const userId = 'user-123';

    it('should return categories for a valid domain', async () => {
      const mockCustom = [
        { id: 'cat-1', name: 'Scuba', icon: '🤿', domain: 'activity' },
      ];
      const mockDefaults = [{ key: 'museum', icon: '🏛️' }];

      vi.mocked(categoryQueries.getUserCategoriesByDomain).mockResolvedValue(mockCustom);
      vi.mocked(defaultCategories.getDefaultCategoriesByDomain).mockReturnValue(mockDefaults);

      const result = await categoryService.getCategoriesByDomain(userId, 'activity');

      expect(result.defaults).toEqual(mockDefaults);
      expect(result.custom).toHaveLength(1);
      expect(result.custom[0].isCustom).toBe(true);
    });

    it('should throw error for invalid domain', async () => {
      await expect(categoryService.getCategoriesByDomain(userId, 'invalid'))
        .rejects
        .toThrow('Invalid domain: invalid');
    });
  });

  describe('getTripCategories', () => {
    it('should delegate to getCategories with owner ID', async () => {
      const ownerId = 'owner-123';

      vi.mocked(categoryQueries.getUserCategories).mockResolvedValue([]);
      vi.mocked(defaultCategories.getDefaultCategories).mockReturnValue({});

      const result = await categoryService.getTripCategories(ownerId);

      expect(categoryQueries.getUserCategories).toHaveBeenCalledWith(ownerId);
      expect(result).toBeDefined();
    });
  });

  describe('createCategory', () => {
    const userId = 'user-123';
    const validData = { name: 'Scuba Diving', icon: '🤿', domain: 'activity' };

    it('should create a category successfully', async () => {
      const mockCreated = {
        id: 'cat-new',
        name: 'Scuba Diving',
        icon: '🤿',
        domain: 'activity',
        created_at: new Date(),
      };

      vi.mocked(categoryQueries.validateCategory).mockReturnValue({ valid: true, errors: [] });
      vi.mocked(categoryQueries.countUserCategories).mockResolvedValue(5);
      vi.mocked(categoryQueries.createCategory).mockResolvedValue(mockCreated);

      const result = await categoryService.createCategory(userId, validData);

      expect(result.id).toBe('cat-new');
      expect(result.name).toBe('Scuba Diving');
      expect(result.isCustom).toBe(true);
      expect(result.ref).toBe('custom:cat-new');
    });

    it('should throw error when validation fails', async () => {
      vi.mocked(categoryQueries.validateCategory).mockReturnValue({
        valid: false,
        errors: ['Category name is required'],
      });

      await expect(categoryService.createCategory(userId, { name: '', icon: '🤿', domain: 'activity' }))
        .rejects
        .toThrow('Category name is required');
    });

    it('should throw error when category limit is reached', async () => {
      vi.mocked(categoryQueries.validateCategory).mockReturnValue({ valid: true, errors: [] });
      vi.mocked(categoryQueries.countUserCategories).mockResolvedValue(100);

      await expect(categoryService.createCategory(userId, validData))
        .rejects
        .toThrow('Maximum of 100 custom categories reached');
    });
  });

  describe('updateCategory', () => {
    const userId = 'user-123';
    const categoryId = 'cat-123';

    it('should update a category successfully', async () => {
      const mockCategory = { id: categoryId, user_id: userId, name: 'Old', icon: '📦', domain: 'activity' };
      const mockUpdated = { ...mockCategory, name: 'New Name', updated_at: new Date() };

      vi.mocked(categoryQueries.getCategoryById).mockResolvedValue(mockCategory);
      vi.mocked(categoryQueries.updateCategory).mockResolvedValue(mockUpdated);

      const result = await categoryService.updateCategory(userId, categoryId, { name: 'New Name' });

      expect(result.name).toBe('New Name');
      expect(result.isCustom).toBe(true);
    });

    it('should throw 404 when category not found', async () => {
      vi.mocked(categoryQueries.getCategoryById).mockResolvedValue(null);

      await expect(categoryService.updateCategory(userId, categoryId, { name: 'Test' }))
        .rejects
        .toThrow('Category not found');
    });

    it('should throw 403 when user does not own category', async () => {
      vi.mocked(categoryQueries.getCategoryById).mockResolvedValue({
        id: categoryId,
        user_id: 'other-user',
      });

      await expect(categoryService.updateCategory(userId, categoryId, { name: 'Test' }))
        .rejects
        .toThrow('You can only edit your own categories');
    });

    it('should throw error for empty name', async () => {
      const mockCategory = { id: categoryId, user_id: userId };

      vi.mocked(categoryQueries.getCategoryById).mockResolvedValue(mockCategory);

      await expect(categoryService.updateCategory(userId, categoryId, { name: '   ' }))
        .rejects
        .toThrow('Category name cannot be empty');
    });

    it('should throw error for name exceeding 50 characters', async () => {
      const mockCategory = { id: categoryId, user_id: userId };

      vi.mocked(categoryQueries.getCategoryById).mockResolvedValue(mockCategory);

      const longName = 'A'.repeat(51);
      await expect(categoryService.updateCategory(userId, categoryId, { name: longName }))
        .rejects
        .toThrow('Category name must be 50 characters or less');
    });

    it('should throw error for icon exceeding 10 characters', async () => {
      const mockCategory = { id: categoryId, user_id: userId };

      vi.mocked(categoryQueries.getCategoryById).mockResolvedValue(mockCategory);

      const longIcon = 'A'.repeat(11);
      await expect(categoryService.updateCategory(userId, categoryId, { icon: longIcon }))
        .rejects
        .toThrow('Category icon must be 10 characters or less');
    });
  });

  describe('deleteCategory', () => {
    const userId = 'user-123';
    const categoryId = 'cat-123';

    it('should delete a category with reassignment', async () => {
      const mockCategory = { id: categoryId, user_id: userId };

      vi.mocked(categoryQueries.getCategoryById).mockResolvedValue(mockCategory);
      vi.mocked(categoryQueries.deleteCategoryWithReassignment).mockResolvedValue({
        deleted: true,
        reassigned: { expenses: 2, activities: 1, documents: 0 },
      });

      const result = await categoryService.deleteCategory(userId, categoryId);

      expect(result.deleted).toBe(true);
      expect(result.reassigned.expenses).toBe(2);
    });

    it('should throw 404 when category not found', async () => {
      vi.mocked(categoryQueries.getCategoryById).mockResolvedValue(null);

      await expect(categoryService.deleteCategory(userId, categoryId))
        .rejects
        .toThrow('Category not found');
    });

    it('should throw 403 when user does not own category', async () => {
      vi.mocked(categoryQueries.getCategoryById).mockResolvedValue({
        id: categoryId,
        user_id: 'other-user',
      });

      await expect(categoryService.deleteCategory(userId, categoryId))
        .rejects
        .toThrow('You can only delete your own categories');
    });
  });

  describe('getUsageCount', () => {
    const userId = 'user-123';
    const categoryId = 'cat-123';

    it('should return usage count for owned category', async () => {
      const mockCategory = { id: categoryId, user_id: userId };
      const mockUsage = { expenses: 3, activities: 2, documents: 0, total: 5 };

      vi.mocked(categoryQueries.getCategoryById).mockResolvedValue(mockCategory);
      vi.mocked(categoryQueries.getCategoryUsageCount).mockResolvedValue(mockUsage);

      const result = await categoryService.getUsageCount(userId, categoryId);

      expect(result.total).toBe(5);
    });

    it('should throw 404 when category not found', async () => {
      vi.mocked(categoryQueries.getCategoryById).mockResolvedValue(null);

      await expect(categoryService.getUsageCount(userId, categoryId))
        .rejects
        .toThrow('Category not found');
    });

    it('should throw 403 when user does not own category', async () => {
      vi.mocked(categoryQueries.getCategoryById).mockResolvedValue({
        id: categoryId,
        user_id: 'other-user',
      });

      await expect(categoryService.getUsageCount(userId, categoryId))
        .rejects
        .toThrow('You can only view usage of your own categories');
    });
  });

  describe('resolveCategory', () => {
    it('should resolve a custom category from provided list', async () => {
      const userCategories = [
        { id: 'cat-1', name: 'Scuba', icon: '🤿' },
      ];

      const result = await categoryService.resolveCategory('custom:cat-1', 'activity', userCategories);

      expect(result.name).toBe('Scuba');
      expect(result.icon).toBe('🤿');
      expect(result.isCustom).toBe(true);
    });

    it('should resolve a custom category from database when list not provided', async () => {
      vi.mocked(categoryQueries.getCategoryById).mockResolvedValue({
        id: 'cat-1',
        name: 'Scuba',
        icon: '🤿',
      });

      const result = await categoryService.resolveCategory('custom:cat-1', 'activity');

      expect(result.name).toBe('Scuba');
      expect(result.isCustom).toBe(true);
    });

    it('should fallback to "other" when custom category was deleted', async () => {
      vi.mocked(categoryQueries.getCategoryById).mockResolvedValue(null);
      vi.mocked(defaultCategories.findDefaultCategory).mockReturnValue({
        key: 'other',
        icon: '📦',
        i18nKey: 'Other',
      });

      const result = await categoryService.resolveCategory('custom:cat-deleted', 'activity');

      expect(result.key).toBe('other');
      expect(result.isCustom).toBe(false);
    });

    it('should resolve a default category by key', async () => {
      vi.mocked(defaultCategories.findDefaultCategory).mockReturnValue({
        key: 'museum',
        icon: '🏛️',
        i18nKey: 'categories.activity.museum',
      });

      const result = await categoryService.resolveCategory('museum', 'activity');

      expect(result.key).toBe('museum');
      expect(result.icon).toBe('🏛️');
      expect(result.isCustom).toBe(false);
    });

    it('should return unknown category as-is with fallback icon', async () => {
      vi.mocked(defaultCategories.findDefaultCategory).mockReturnValue(null);

      const result = await categoryService.resolveCategory('unknownType', 'activity');

      expect(result.name).toBe('unknownType');
      expect(result.icon).toBe('📦');
      expect(result.isCustom).toBe(false);
    });
  });

  describe('getValidDomains', () => {
    it('should return a copy of valid domains', () => {
      const result = categoryService.getValidDomains();

      expect(result).toEqual(['activity', 'expense', 'document']);
    });

    it('should return a new array (not the original)', () => {
      const result1 = categoryService.getValidDomains();
      const result2 = categoryService.getValidDomains();

      expect(result1).not.toBe(result2);
    });
  });

  describe('getMaxCategoriesLimit', () => {
    it('should return the max categories per user', () => {
      const result = categoryService.getMaxCategoriesLimit();

      expect(result).toBe(100);
    });
  });
});
