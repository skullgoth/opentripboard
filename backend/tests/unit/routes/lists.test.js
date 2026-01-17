
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

// Mock pg module at the top
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

describe('Lists Routes', () => {
  let app;
  let listQueries;
  let tripQueries;
  let tripBuddyQueries;

  beforeEach(async () => {
    vi.resetModules(); // Reset modules to allow re-importing with fresh mocks

    // Mock services and middleware using vi.doMock
    vi.doMock('../../../src/db/queries/lists.js', () => ({
      create: vi.fn(),
      findByTripId: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
      deleteList: vi.fn(),
      updateItems: vi.fn(),
      addItem: vi.fn(),
      toggleItem: vi.fn(),
      removeItem: vi.fn(),
      reorderItems: vi.fn(),
    }));

    vi.doMock('../../../src/db/queries/trips.js', () => ({
      findById: vi.fn(),
    }));

    vi.doMock('../../../src/db/queries/trip-buddies.js', () => ({
      findByTripAndUser: vi.fn(),
    }));

    vi.doMock('../../../src/middleware/auth.js', () => ({
      authenticate: vi.fn((req, reply, done) => {
        req.user = { userId: 'user-123' };
        done();
      }),
    }));

    vi.doMock('../../../src/middleware/validation.js', () => ({
      validateBody: vi.fn(() => (req, reply, done) => done()),
      validateParams: vi.fn(() => (req, reply, done) => done()),
    }));

    vi.doMock('../../../src/middleware/error-handler.js', () => ({
      asyncHandler: (fn) => async (req, reply) => {
        try {
          await fn(req, reply);
        } catch (err) {
          reply.status(err.statusCode || 500).send({ error: err.message });
        }
      },
      NotFoundError: class NotFoundError extends Error {
        constructor(message) { super(message); this.statusCode = 404; }
      },
      AuthorizationError: class AuthorizationError extends Error {
        constructor(message) { super(message); this.statusCode = 403; }
      },
    }));

    // Dynamically import the router and mocked service after mocks are in place
    const listRoutes = (await import('../../../src/routes/lists.js')).default;
    listQueries = await import('../../../src/db/queries/lists.js');
    tripQueries = await import('../../../src/db/queries/trips.js');
    tripBuddyQueries = await import('../../../src/db/queries/trip-buddies.js');

    app = Fastify();
    app.register(listRoutes);
  });

  describe('GET /list-templates', () => {
    it('should return a list of available list templates', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/list-templates',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload).toBeInstanceOf(Array);
      expect(payload.length).toBeGreaterThan(0);
      expect(payload[0]).toHaveProperty('id');
      expect(payload[0]).toHaveProperty('title');
      expect(payload[0]).toHaveProperty('type');
      expect(payload[0]).toHaveProperty('itemCount');
    });
  });

  describe('GET /list-templates/:templateId', () => {
    it('should return a specific list template', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/list-templates/cold-weather',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload).toHaveProperty('id', 'cold-weather');
      expect(payload).toHaveProperty('title', 'Cold Weather Packing');
      expect(payload).toHaveProperty('type', 'packing');
      expect(payload.items).toBeInstanceOf(Array);
      expect(payload.items.length).toBeGreaterThan(0);
    });

    it('should return 404 if template is not found', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/list-templates/non-existent-template',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Template');
    });
  });

  describe('GET /trips/:tripId/lists', () => {
    it('should return all lists for a trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockLists = [
        { id: 'list-1', title: 'Packing List', type: 'packing', items: [{ text: 'item1', checked: false }] },
      ];

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() }); // User is collaborator
      listQueries.findByTripId.mockResolvedValue(mockLists);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/lists',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload).toBeInstanceOf(Array);
      expect(payload.length).toBe(1);
      expect(payload[0]).toHaveProperty('title', 'Packing List');
      expect(payload[0].stats).toEqual({ total: 1, checked: 0, percentage: 0 });
      expect(listQueries.findByTripId).toHaveBeenCalledWith('trip-123');
    });

    it('should return 404 if trip not found', async () => {
      tripQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/lists',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Trip');
    });

    it('should return 403 if user does not have access to trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'other-user' };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue(null); // Not a collaborator

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/lists',
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.payload).error).toBe('You do not have access to this trip');
    });
  });

  describe('POST /trips/:tripId/lists', () => {
    it('should create a new list for a trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const newListData = { title: 'New List', type: 'custom', items: [] };
      const mockCreatedList = { id: 'list-new', tripId: 'trip-123', ...newListData };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      listQueries.create.mockResolvedValue(mockCreatedList);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/lists',
        payload: newListData,
      });

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.payload)).toEqual(mockCreatedList);
      expect(listQueries.create).toHaveBeenCalledWith({
        tripId: 'trip-123',
        createdBy: 'user-123',
        ...newListData,
      });
    });

    it('should return 404 if trip not found', async () => {
      tripQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/lists',
        payload: { title: 'New List', type: 'custom' },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Trip');
    });

    it('should return 403 if user does not have access to trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'other-user' };
      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/lists',
        payload: { title: 'New List', type: 'custom' },
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.payload).error).toBe('You do not have access to this trip');
    });
  });

  describe('POST /trips/:tripId/lists/from-template/:templateId', () => {
    it('should create a new list from a template', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockTemplate = {
        title: 'Cold Weather Packing',
        type: 'packing',
        items: [
          { text: 'Winter coat', checked: false },
          { text: 'Gloves', checked: false },
          { text: 'Thermal underwear', checked: false },
          { text: 'Warm hat/beanie', checked: false },
          { text: 'Scarf', checked: false },
          { text: 'Warm socks (multiple pairs)', checked: false },
          { text: 'Boots/waterproof shoes', checked: false },
          { text: 'Sweaters/fleece', checked: false },
          { text: 'Hand warmers', checked: false },
          { text: 'Lip balm', checked: false },
          { text: 'Moisturizer', checked: false },
          { text: 'Sunglasses', checked: false },
        ],
      };
      const mockCreatedList = { id: 'list-new', tripId: 'trip-123', ...mockTemplate };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      listQueries.create.mockResolvedValue(mockCreatedList);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/lists/from-template/cold-weather',
      });

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.payload)).toEqual(mockCreatedList);
      expect(listQueries.create).toHaveBeenCalledWith({
        tripId: 'trip-123',
        createdBy: 'user-123',
        title: mockTemplate.title,
        type: mockTemplate.type,
        items: mockTemplate.items,
      });
    });

    it('should return 404 if trip not found', async () => {
      tripQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/lists/from-template/cold-weather',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Trip');
    });

    it('should return 403 if user does not have access to trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'other-user' };
      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/lists/from-template/cold-weather',
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.payload).error).toBe('You do not have access to this trip');
    });

    it('should return 404 if template is not found', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/lists/from-template/non-existent-template',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Template');
    });
  });

  describe('GET /trips/:tripId/lists/:listId', () => {
    it('should return a specific list', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockList = {
        id: 'list-1',
        tripId: 'trip-123',
        title: 'Packing List',
        type: 'packing',
        items: [{ text: 'item1', checked: false }],
      };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      listQueries.findById.mockResolvedValue(mockList);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/lists/list-1',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload).toHaveProperty('id', 'list-1');
      expect(payload.stats).toEqual({ total: 1, checked: 0, percentage: 0 });
      expect(listQueries.findById).toHaveBeenCalledWith('list-1');
    });

    it('should return 404 if trip not found', async () => {
      tripQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/lists/list-1',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Trip');
    });

    it('should return 403 if user does not have access to trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'other-user' };
      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/lists/list-1',
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.payload).error).toBe('You do not have access to this trip');
    });

    it('should return 404 if list not found for trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      listQueries.findById.mockResolvedValue(null); // List not found

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/lists/list-1',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('List');
    });

    it('should return 404 if list belongs to another trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockList = { id: 'list-1', tripId: 'another-trip', title: 'Packing List', type: 'packing', items: [] };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      listQueries.findById.mockResolvedValue(mockList);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/lists/list-1',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('List');
    });
  });

  describe('PATCH /trips/:tripId/lists/:listId', () => {
    it('should update a list', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockList = { id: 'list-1', tripId: 'trip-123', title: 'Packing List', type: 'packing', items: [] };
      const updateData = { title: 'Updated Packing List' };
      const mockUpdatedList = { ...mockList, ...updateData };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      listQueries.findById.mockResolvedValue(mockList);
      listQueries.update.mockResolvedValue(mockUpdatedList);

      const response = await app.inject({
        method: 'PATCH',
        url: '/trips/trip-123/lists/list-1',
        payload: updateData,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(mockUpdatedList);
      expect(listQueries.update).toHaveBeenCalledWith('list-1', updateData);
    });

    it('should return 404 if trip not found', async () => {
      tripQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'PATCH',
        url: '/trips/trip-123/lists/list-1',
        payload: { title: 'New Title' },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Trip');
    });

    it('should return 403 if user does not have access to trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'other-user' };
      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue(null);

      const response = await app.inject({
        method: 'PATCH',
        url: '/trips/trip-123/lists/list-1',
        payload: { title: 'New Title' },
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.payload).error).toBe('You do not have access to this trip');
    });

    it('should return 404 if list not found for trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      listQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'PATCH',
        url: '/trips/trip-123/lists/list-1',
        payload: { title: 'New Title' },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('List');
    });

    it('should return 404 if list belongs to another trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockList = { id: 'list-1', tripId: 'another-trip', title: 'Packing List', type: 'packing', items: [] };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      listQueries.findById.mockResolvedValue(mockList);

      const response = await app.inject({
        method: 'PATCH',
        url: '/trips/trip-123/lists/list-1',
        payload: { title: 'New Title' },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('List');
    });
  });

  describe('DELETE /trips/:tripId/lists/:listId', () => {
    it('should delete a list', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockList = { id: 'list-1', tripId: 'trip-123', title: 'Packing List', type: 'packing', items: [] };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      listQueries.findById.mockResolvedValue(mockList);
      listQueries.deleteList.mockResolvedValue(true);

      const response = await app.inject({
        method: 'DELETE',
        url: '/trips/trip-123/lists/list-1',
      });

      expect(response.statusCode).toBe(204);
      expect(listQueries.deleteList).toHaveBeenCalledWith('list-1');
    });

    it('should return 404 if trip not found', async () => {
      tripQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'DELETE',
        url: '/trips/trip-123/lists/list-1',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Trip');
    });

    it('should return 403 if user does not have access to trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'other-user' };
      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue(null);

      const response = await app.inject({
        method: 'DELETE',
        url: '/trips/trip-123/lists/list-1',
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.payload).error).toBe('You do not have access to this trip');
    });

    it('should return 404 if list not found for trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      listQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'DELETE',
        url: '/trips/trip-123/lists/list-1',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('List');
    });

    it('should return 404 if list belongs to another trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockList = { id: 'list-1', tripId: 'another-trip', title: 'Packing List', type: 'packing', items: [] };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      listQueries.findById.mockResolvedValue(mockList);

      const response = await app.inject({
        method: 'DELETE',
        url: '/trips/trip-123/lists/list-1',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('List');
    });
  });

  describe('PUT /trips/:tripId/lists/:listId/items', () => {
    it('should update all items in a list', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockList = { id: 'list-1', tripId: 'trip-123', title: 'Packing List', type: 'packing', items: [] };
      const newItems = [{ text: 'New Item 1', checked: false }];
      const mockUpdatedList = { ...mockList, items: newItems };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      listQueries.findById.mockResolvedValue(mockList);
      listQueries.updateItems.mockResolvedValue(mockUpdatedList);

      const response = await app.inject({
        method: 'PUT',
        url: '/trips/trip-123/lists/list-1/items',
        payload: { items: newItems },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(mockUpdatedList);
      expect(listQueries.updateItems).toHaveBeenCalledWith('list-1', newItems);
    });

    it('should return 404 if trip not found', async () => {
      tripQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'PUT',
        url: '/trips/trip-123/lists/list-1/items',
        payload: { items: [] },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Trip');
    });

    it('should return 403 if user does not have access to trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'other-user' };
      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue(null);

      const response = await app.inject({
        method: 'PUT',
        url: '/trips/trip-123/lists/list-1/items',
        payload: { items: [] },
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.payload).error).toBe('You do not have access to this trip');
    });

    it('should return 404 if list not found for trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      listQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'PUT',
        url: '/trips/trip-123/lists/list-1/items',
        payload: { items: [] },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('List');
    });

    it('should return 404 if list belongs to another trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockList = { id: 'list-1', tripId: 'another-trip', title: 'Packing List', type: 'packing', items: [] };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      listQueries.findById.mockResolvedValue(mockList);

      const response = await app.inject({
        method: 'PUT',
        url: '/trips/trip-123/lists/list-1/items',
        payload: { items: [] },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('List');
    });
  });

  describe('POST /trips/:tripId/lists/:listId/items', () => {
    it('should add an item to a list', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockList = { id: 'list-1', tripId: 'trip-123', title: 'Packing List', type: 'packing', items: [] };
      const newItemData = { text: 'New Item', checked: false };
      const mockUpdatedList = { ...mockList, items: [{ ...newItemData, id: 'item-1' }] };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      listQueries.findById.mockResolvedValue(mockList);
      listQueries.addItem.mockResolvedValue(mockUpdatedList);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/lists/list-1/items',
        payload: newItemData,
      });

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.payload)).toEqual(mockUpdatedList);
      expect(listQueries.addItem).toHaveBeenCalledWith('list-1', newItemData);
    });

    it('should return 404 if trip not found', async () => {
      tripQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/lists/list-1/items',
        payload: { text: 'New Item' },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Trip');
    });

    it('should return 403 if user does not have access to trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'other-user' };
      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/lists/list-1/items',
        payload: { text: 'New Item' },
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.payload).error).toBe('You do not have access to this trip');
    });

    it('should return 404 if list not found for trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      listQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/lists/list-1/items',
        payload: { text: 'New Item' },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('List');
    });

    it('should return 404 if list belongs to another trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockList = { id: 'list-1', tripId: 'another-trip', title: 'Packing List', type: 'packing', items: [] };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      listQueries.findById.mockResolvedValue(mockList);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/lists/list-1/items',
        payload: { text: 'New Item' },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('List');
    });
  });

  describe('PATCH /trips/:tripId/lists/:listId/items/:itemId', () => {
    it('should toggle item checked status', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockList = { id: 'list-1', tripId: 'trip-123', title: 'Packing List', type: 'packing', items: [] };
      const mockUpdatedList = { ...mockList, items: [{ id: 'item-1', text: 'Item 1', checked: true }] };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      listQueries.findById.mockResolvedValue(mockList);
      listQueries.toggleItem.mockResolvedValue(mockUpdatedList);

      const response = await app.inject({
        method: 'PATCH',
        url: '/trips/trip-123/lists/list-1/items/item-1',
        payload: { checked: true },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(mockUpdatedList);
      expect(listQueries.toggleItem).toHaveBeenCalledWith('list-1', 'item-1', true);
    });

    it('should return 404 if trip not found', async () => {
      tripQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'PATCH',
        url: '/trips/trip-123/lists/list-1/items/item-1',
        payload: { checked: true },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Trip');
    });

    it('should return 403 if user does not have access to trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'other-user' };
      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue(null);

      const response = await app.inject({
        method: 'PATCH',
        url: '/trips/trip-123/lists/list-1/items/item-1',
        payload: { checked: true },
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.payload).error).toBe('You do not have access to this trip');
    });

    it('should return 404 if list not found for trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      listQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'PATCH',
        url: '/trips/trip-123/lists/list-1/items/item-1',
        payload: { checked: true },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('List');
    });

    it('should return 404 if list belongs to another trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockList = { id: 'list-1', tripId: 'another-trip', title: 'Packing List', type: 'packing', items: [] };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      listQueries.findById.mockResolvedValue(mockList);

      const response = await app.inject({
        method: 'PATCH',
        url: '/trips/trip-123/lists/list-1/items/item-1',
        payload: { checked: true },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('List');
    });
  });

  describe('DELETE /trips/:tripId/lists/:listId/items/:itemId', () => {
    it('should delete an item from a list', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockList = { id: 'list-1', tripId: 'trip-123', title: 'Packing List', type: 'packing', items: [{ id: 'item-1', text: 'Item 1', checked: false }] };
      const mockUpdatedList = { ...mockList, items: [] };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      listQueries.findById.mockResolvedValue(mockList);
      listQueries.removeItem.mockResolvedValue(mockUpdatedList);

      const response = await app.inject({
        method: 'DELETE',
        url: '/trips/trip-123/lists/list-1/items/item-1',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(mockUpdatedList);
      expect(listQueries.removeItem).toHaveBeenCalledWith('list-1', 'item-1');
    });

    it('should return 404 if trip not found', async () => {
      tripQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'DELETE',
        url: '/trips/trip-123/lists/list-1/items/item-1',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Trip');
    });

    it('should return 403 if user does not have access to trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'other-user' };
      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue(null);

      const response = await app.inject({
        method: 'DELETE',
        url: '/trips/trip-123/lists/list-1/items/item-1',
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.payload).error).toBe('You do not have access to this trip');
    });

    it('should return 404 if list not found for trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      listQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'DELETE',
        url: '/trips/trip-123/lists/list-1/items/item-1',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('List');
    });

    it('should return 404 if list belongs to another trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockList = { id: 'list-1', tripId: 'another-trip', title: 'Packing List', type: 'packing', items: [] };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      listQueries.findById.mockResolvedValue(mockList);

      const response = await app.inject({
        method: 'DELETE',
        url: '/trips/trip-123/lists/list-1/items/item-1',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('List');
    });
  });

  describe('POST /trips/:tripId/lists/:listId/reorder', () => {
    it('should reorder items in a list', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockList = { id: 'list-1', tripId: 'trip-123', title: 'Packing List', type: 'packing', items: [] };
      const reorderedItemIds = ['item-3', 'item-1', 'item-2'];
      const mockUpdatedList = { ...mockList, items: [{ id: 'item-3' }, { id: 'item-1' }, { id: 'item-2' }] };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      listQueries.findById.mockResolvedValue(mockList);
      listQueries.reorderItems.mockResolvedValue(mockUpdatedList);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/lists/list-1/reorder',
        payload: { itemIds: reorderedItemIds },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(mockUpdatedList);
      expect(listQueries.reorderItems).toHaveBeenCalledWith('list-1', reorderedItemIds);
    });

    it('should return 404 if trip not found', async () => {
      tripQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/lists/list-1/reorder',
        payload: { itemIds: [] },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Trip');
    });

    it('should return 403 if user does not have access to trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'other-user' };
      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/lists/list-1/reorder',
        payload: { itemIds: [] },
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.payload).error).toBe('You do not have access to this trip');
    });

    it('should return 404 if list not found for trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      listQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/lists/list-1/reorder',
        payload: { itemIds: [] },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('List');
    });

    it('should return 404 if list belongs to another trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockList = { id: 'list-1', tripId: 'another-trip', title: 'Packing List', type: 'packing', items: [] };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      listQueries.findById.mockResolvedValue(mockList);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/lists/list-1/reorder',
        payload: { itemIds: [] },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('List');
    });
  });
});
