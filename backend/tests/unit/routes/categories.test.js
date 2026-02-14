import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

vi.mock('pg', () => {
  const mockPool = {
    connect: vi.fn(),
    query: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
  };
  const mockPg = { Pool: vi.fn(() => mockPool) };
  return { default: mockPg, ...mockPg };
});

describe('Categories Routes', () => {
  let app;
  let categoryService;
  let getTripById;

  beforeEach(async () => {
    vi.resetModules();

    vi.doMock('../../../src/services/category-service.js', () => ({
      default: {
        getCategories: vi.fn(),
        createCategory: vi.fn(),
        updateCategory: vi.fn(),
        deleteCategory: vi.fn(),
        getUsageCount: vi.fn(),
        getTripCategories: vi.fn(),
      },
    }));

    vi.doMock('../../../src/utils/default-categories.js', () => ({
      getDefaultCategories: vi.fn(() => ({
        activity: [{ key: 'attraction', icon: '🏛️', i18nKey: 'category.attraction' }],
        expense: [{ key: 'food', icon: '🍽️', i18nKey: 'category.food' }],
      })),
    }));

    vi.doMock('../../../src/db/queries/trips.js', () => ({
      findById: vi.fn(),
    }));

    vi.doMock('../../../src/middleware/auth.js', () => ({
      authenticate: vi.fn((req, reply, done) => {
        req.user = { userId: 'user-123' };
        done();
      }),
    }));

    const categoriesRouter = (await import('../../../src/routes/categories.js')).default;
    categoryService = (await import('../../../src/services/category-service.js')).default;
    getTripById = (await import('../../../src/db/queries/trips.js')).findById;

    app = Fastify();
    app.register(categoriesRouter);
  });

  describe('GET /categories', () => {
    it('should return user categories', async () => {
      const mockCategories = [
        { id: 'cat-1', name: 'Food', icon: '🍽️', domain: 'expense', isCustom: false },
      ];
      categoryService.getCategories.mockResolvedValue(mockCategories);

      const response = await app.inject({
        method: 'GET',
        url: '/categories',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
    });
  });

  describe('GET /categories/defaults', () => {
    it('should return default categories without auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/categories/defaults',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
    });
  });

  describe('POST /categories', () => {
    it('should create a custom category', async () => {
      const newCategory = { id: 'cat-new', name: 'Souvenirs', icon: '🎁', domain: 'expense', isCustom: true };
      categoryService.createCategory.mockResolvedValue(newCategory);

      const response = await app.inject({
        method: 'POST',
        url: '/categories',
        payload: { name: 'Souvenirs', icon: '🎁', domain: 'expense' },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Souvenirs');
    });
  });

  describe('PUT /categories/:id', () => {
    it('should update a custom category', async () => {
      const updated = { id: 'cat-1', name: 'Updated', icon: '✨', domain: 'expense', isCustom: true };
      categoryService.updateCategory.mockResolvedValue(updated);

      const response = await app.inject({
        method: 'PUT',
        url: '/categories/550e8400-e29b-41d4-a716-446655440000',
        payload: { name: 'Updated', icon: '✨' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Updated');
    });
  });

  describe('DELETE /categories/:id', () => {
    it('should delete a custom category', async () => {
      categoryService.deleteCategory.mockResolvedValue({
        reassigned: { expenses: 2, activities: 1, reservations: 0, documents: 0 },
      });

      const response = await app.inject({
        method: 'DELETE',
        url: '/categories/550e8400-e29b-41d4-a716-446655440000',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.reassigned.expenses).toBe(2);
    });
  });

  describe('GET /categories/:id/usage', () => {
    it('should return usage count for a category', async () => {
      categoryService.getUsageCount.mockResolvedValue({
        expenses: 5, activities: 3, reservations: 1, documents: 0, total: 9,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/categories/550e8400-e29b-41d4-a716-446655440000/usage',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data.total).toBe(9);
    });
  });

  describe('GET /trips/:tripId/categories', () => {
    it('should return categories for a trip', async () => {
      getTripById.mockResolvedValue({ id: 'trip-123', owner_id: 'user-123' });
      categoryService.getTripCategories.mockResolvedValue([
        { id: 'cat-1', name: 'Food', domain: 'expense' },
      ]);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/550e8400-e29b-41d4-a716-446655440000/categories',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
    });

    it('should return 404 if trip not found', async () => {
      getTripById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/550e8400-e29b-41d4-a716-446655440000/categories',
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
