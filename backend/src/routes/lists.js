// T229 & T230: List routes - CRUD and templates endpoints
import * as listQueries from '../db/queries/lists.js';
import * as tripQueries from '../db/queries/trips.js';
import * as tripBuddyQueries from '../db/queries/trip-buddies.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import { asyncHandler, NotFoundError, AuthorizationError } from '../middleware/error-handler.js';

const tripIdSchema = {
  type: 'object',
  required: ['tripId'],
  properties: {
    tripId: {
      type: 'string',
      format: 'uuid',
    },
  },
};

const listIdSchema = {
  type: 'object',
  required: ['tripId', 'listId'],
  properties: {
    tripId: {
      type: 'string',
      format: 'uuid',
    },
    listId: {
      type: 'string',
      format: 'uuid',
    },
  },
};

const itemIdSchema = {
  type: 'object',
  required: ['tripId', 'listId', 'itemId'],
  properties: {
    tripId: {
      type: 'string',
      format: 'uuid',
    },
    listId: {
      type: 'string',
      format: 'uuid',
    },
    itemId: {
      type: 'string',
      format: 'uuid',
    },
  },
};

const createListSchema = {
  type: 'object',
  required: ['title', 'type'],
  properties: {
    title: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
    },
    type: {
      type: 'string',
      enum: ['packing', 'todo', 'shopping', 'custom'],
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['text'],
        properties: {
          id: { type: 'string' },
          text: { type: 'string', minLength: 1 },
          checked: { type: 'boolean' },
          order: { type: 'number' },
        },
      },
    },
  },
};

const updateListSchema = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
    },
    type: {
      type: 'string',
      enum: ['packing', 'todo', 'shopping', 'custom'],
    },
  },
};

const updateItemsSchema = {
  type: 'object',
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['text'],
        properties: {
          id: { type: 'string' },
          text: { type: 'string', minLength: 1 },
          checked: { type: 'boolean' },
          order: { type: 'number' },
        },
      },
    },
  },
};

const addItemSchema = {
  type: 'object',
  required: ['text'],
  properties: {
    text: {
      type: 'string',
      minLength: 1,
      maxLength: 500,
    },
    checked: {
      type: 'boolean',
    },
  },
};

const toggleItemSchema = {
  type: 'object',
  required: ['checked'],
  properties: {
    checked: {
      type: 'boolean',
    },
  },
};

const reorderItemsSchema = {
  type: 'object',
  required: ['itemIds'],
  properties: {
    itemIds: {
      type: 'array',
      items: { type: 'string' },
    },
  },
};

// Packing list templates
const LIST_TEMPLATES = {
  'cold-weather': {
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
  },
  'beach': {
    title: 'Beach Vacation Packing',
    type: 'packing',
    items: [
      { text: 'Swimsuit(s)', checked: false },
      { text: 'Sunscreen', checked: false },
      { text: 'Sunglasses', checked: false },
      { text: 'Beach towel', checked: false },
      { text: 'Flip flops/sandals', checked: false },
      { text: 'Hat/sun hat', checked: false },
      { text: 'Beach bag', checked: false },
      { text: 'Coverup/sarong', checked: false },
      { text: 'Aloe vera (for sunburn)', checked: false },
      { text: 'Waterproof phone case', checked: false },
      { text: 'Snorkeling gear', checked: false },
      { text: 'Beach read/book', checked: false },
    ],
  },
  'business': {
    title: 'Business Trip Packing',
    type: 'packing',
    items: [
      { text: 'Business suits/attire', checked: false },
      { text: 'Dress shoes', checked: false },
      { text: 'Laptop & charger', checked: false },
      { text: 'Business cards', checked: false },
      { text: 'Notebook/portfolio', checked: false },
      { text: 'Phone charger', checked: false },
      { text: 'Ties/accessories', checked: false },
      { text: 'Iron/steamer (or hotel service)', checked: false },
      { text: 'Toiletries kit', checked: false },
      { text: 'Travel adapter', checked: false },
      { text: 'Presentation materials', checked: false },
      { text: 'Casual clothes for downtime', checked: false },
    ],
  },
  'camping': {
    title: 'Camping Trip Packing',
    type: 'packing',
    items: [
      { text: 'Tent', checked: false },
      { text: 'Sleeping bag', checked: false },
      { text: 'Sleeping pad/air mattress', checked: false },
      { text: 'Flashlight/headlamp', checked: false },
      { text: 'Camp stove & fuel', checked: false },
      { text: 'Cooler', checked: false },
      { text: 'Water bottles', checked: false },
      { text: 'First aid kit', checked: false },
      { text: 'Bug spray', checked: false },
      { text: 'Matches/lighter', checked: false },
      { text: 'Multi-tool/knife', checked: false },
      { text: 'Camp chairs', checked: false },
      { text: 'Firewood/fire starter', checked: false },
      { text: 'Cooking utensils', checked: false },
    ],
  },
  'essentials': {
    title: 'Travel Essentials',
    type: 'packing',
    items: [
      { text: 'Passport/ID', checked: false },
      { text: 'Wallet/money', checked: false },
      { text: 'Phone & charger', checked: false },
      { text: 'Medications', checked: false },
      { text: 'Toothbrush & toothpaste', checked: false },
      { text: 'Deodorant', checked: false },
      { text: 'Underwear', checked: false },
      { text: 'Socks', checked: false },
      { text: 'Comfortable shoes', checked: false },
      { text: 'Jacket/layers', checked: false },
      { text: 'Headphones', checked: false },
      { text: 'Travel insurance docs', checked: false },
    ],
  },
  'todo': {
    title: 'Pre-Trip Checklist',
    type: 'todo',
    items: [
      { text: 'Book flights', checked: false },
      { text: 'Book accommodation', checked: false },
      { text: 'Check passport validity', checked: false },
      { text: 'Apply for visa (if needed)', checked: false },
      { text: 'Get travel insurance', checked: false },
      { text: 'Notify bank of travel', checked: false },
      { text: 'Set up international phone plan', checked: false },
      { text: 'Research destination', checked: false },
      { text: 'Make copies of important documents', checked: false },
      { text: 'Arrange pet/plant care', checked: false },
      { text: 'Set mail hold', checked: false },
      { text: 'Pack bags', checked: false },
    ],
  },
};

/**
 * Check if user has access to trip
 */
async function checkTripAccess(tripId, userId) {
  const trip = await tripQueries.findById(tripId);
  if (!trip) {
    throw new NotFoundError('Trip');
  }

  // Check if user is owner or collaborator
  const isOwner = trip.owner_id === userId;
  const tripBuddy = await tripBuddyQueries.findByTripAndUser(tripId, userId);
  const isCollaborator = tripBuddy && tripBuddy.accepted_at;

  if (!isOwner && !isCollaborator) {
    throw new AuthorizationError('You do not have access to this trip');
  }

  return trip;
}

export default async function listRoutes(fastify) {
  /**
   * Get list templates
   * GET /api/v1/list-templates
   */
  fastify.get(
    '/list-templates',
    {
      preHandler: authenticate,
    },
    asyncHandler(async (request, reply) => {
      const templates = Object.entries(LIST_TEMPLATES).map(([id, template]) => ({
        id,
        title: template.title,
        type: template.type,
        itemCount: template.items.length,
      }));
      reply.send(templates);
    })
  );

  /**
   * Get a specific template
   * GET /api/v1/list-templates/:templateId
   */
  fastify.get(
    '/list-templates/:templateId',
    {
      preHandler: authenticate,
    },
    asyncHandler(async (request, reply) => {
      const { templateId } = request.params;
      const template = LIST_TEMPLATES[templateId];

      if (!template) {
        throw new NotFoundError('Template');
      }

      reply.send({
        id: templateId,
        ...template,
      });
    })
  );

  /**
   * Get all lists for a trip
   * GET /api/v1/trips/:tripId/lists
   */
  fastify.get(
    '/trips/:tripId/lists',
    {
      preHandler: [authenticate, validateParams(tripIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      await checkTripAccess(request.params.tripId, request.user.userId);

      const lists = await listQueries.findByTripId(request.params.tripId);

      // Add stats to each list
      const listsWithStats = lists.map(list => ({
        ...list,
        stats: {
          total: list.items.length,
          checked: list.items.filter(i => i.checked).length,
          percentage: list.items.length > 0
            ? Math.round((list.items.filter(i => i.checked).length / list.items.length) * 100)
            : 0,
        },
      }));

      reply.send(listsWithStats);
    })
  );

  /**
   * Create a new list
   * POST /api/v1/trips/:tripId/lists
   */
  fastify.post(
    '/trips/:tripId/lists',
    {
      preHandler: [authenticate, validateParams(tripIdSchema), validateBody(createListSchema)],
    },
    asyncHandler(async (request, reply) => {
      await checkTripAccess(request.params.tripId, request.user.userId);

      const list = await listQueries.create({
        tripId: request.params.tripId,
        createdBy: request.user.userId,
        ...request.body,
      });

      reply.code(201).send(list);
    })
  );

  /**
   * Create list from template
   * POST /api/v1/trips/:tripId/lists/from-template/:templateId
   */
  fastify.post(
    '/trips/:tripId/lists/from-template/:templateId',
    {
      preHandler: [authenticate, validateParams(tripIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      await checkTripAccess(request.params.tripId, request.user.userId);

      const { templateId } = request.params;
      const template = LIST_TEMPLATES[templateId];

      if (!template) {
        throw new NotFoundError('Template');
      }

      const list = await listQueries.create({
        tripId: request.params.tripId,
        createdBy: request.user.userId,
        title: template.title,
        type: template.type,
        items: template.items,
      });

      reply.code(201).send(list);
    })
  );

  /**
   * Get a specific list
   * GET /api/v1/trips/:tripId/lists/:listId
   */
  fastify.get(
    '/trips/:tripId/lists/:listId',
    {
      preHandler: [authenticate, validateParams(listIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      await checkTripAccess(request.params.tripId, request.user.userId);

      const list = await listQueries.findById(request.params.listId);
      if (!list || list.tripId !== request.params.tripId) {
        throw new NotFoundError('List');
      }

      const stats = {
        total: list.items.length,
        checked: list.items.filter(i => i.checked).length,
        percentage: list.items.length > 0
          ? Math.round((list.items.filter(i => i.checked).length / list.items.length) * 100)
          : 0,
      };

      reply.send({ ...list, stats });
    })
  );

  /**
   * Update a list
   * PATCH /api/v1/trips/:tripId/lists/:listId
   */
  fastify.patch(
    '/trips/:tripId/lists/:listId',
    {
      preHandler: [authenticate, validateParams(listIdSchema), validateBody(updateListSchema)],
    },
    asyncHandler(async (request, reply) => {
      await checkTripAccess(request.params.tripId, request.user.userId);

      const existingList = await listQueries.findById(request.params.listId);
      if (!existingList || existingList.tripId !== request.params.tripId) {
        throw new NotFoundError('List');
      }

      const list = await listQueries.update(request.params.listId, request.body);
      reply.send(list);
    })
  );

  /**
   * Delete a list
   * DELETE /api/v1/trips/:tripId/lists/:listId
   */
  fastify.delete(
    '/trips/:tripId/lists/:listId',
    {
      preHandler: [authenticate, validateParams(listIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      await checkTripAccess(request.params.tripId, request.user.userId);

      const existingList = await listQueries.findById(request.params.listId);
      if (!existingList || existingList.tripId !== request.params.tripId) {
        throw new NotFoundError('List');
      }

      await listQueries.deleteList(request.params.listId);
      reply.code(204).send();
    })
  );

  /**
   * Update list items
   * PUT /api/v1/trips/:tripId/lists/:listId/items
   */
  fastify.put(
    '/trips/:tripId/lists/:listId/items',
    {
      preHandler: [authenticate, validateParams(listIdSchema), validateBody(updateItemsSchema)],
    },
    asyncHandler(async (request, reply) => {
      await checkTripAccess(request.params.tripId, request.user.userId);

      const existingList = await listQueries.findById(request.params.listId);
      if (!existingList || existingList.tripId !== request.params.tripId) {
        throw new NotFoundError('List');
      }

      const list = await listQueries.updateItems(request.params.listId, request.body.items);
      reply.send(list);
    })
  );

  /**
   * Add item to list
   * POST /api/v1/trips/:tripId/lists/:listId/items
   */
  fastify.post(
    '/trips/:tripId/lists/:listId/items',
    {
      preHandler: [authenticate, validateParams(listIdSchema), validateBody(addItemSchema)],
    },
    asyncHandler(async (request, reply) => {
      await checkTripAccess(request.params.tripId, request.user.userId);

      const existingList = await listQueries.findById(request.params.listId);
      if (!existingList || existingList.tripId !== request.params.tripId) {
        throw new NotFoundError('List');
      }

      const list = await listQueries.addItem(request.params.listId, request.body);
      reply.code(201).send(list);
    })
  );

  /**
   * Toggle item checked status
   * PATCH /api/v1/trips/:tripId/lists/:listId/items/:itemId
   */
  fastify.patch(
    '/trips/:tripId/lists/:listId/items/:itemId',
    {
      preHandler: [authenticate, validateParams(itemIdSchema), validateBody(toggleItemSchema)],
    },
    asyncHandler(async (request, reply) => {
      await checkTripAccess(request.params.tripId, request.user.userId);

      const existingList = await listQueries.findById(request.params.listId);
      if (!existingList || existingList.tripId !== request.params.tripId) {
        throw new NotFoundError('List');
      }

      const list = await listQueries.toggleItem(
        request.params.listId,
        request.params.itemId,
        request.body.checked
      );
      reply.send(list);
    })
  );

  /**
   * Delete item from list
   * DELETE /api/v1/trips/:tripId/lists/:listId/items/:itemId
   */
  fastify.delete(
    '/trips/:tripId/lists/:listId/items/:itemId',
    {
      preHandler: [authenticate, validateParams(itemIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      await checkTripAccess(request.params.tripId, request.user.userId);

      const existingList = await listQueries.findById(request.params.listId);
      if (!existingList || existingList.tripId !== request.params.tripId) {
        throw new NotFoundError('List');
      }

      const list = await listQueries.removeItem(request.params.listId, request.params.itemId);
      reply.send(list);
    })
  );

  /**
   * Reorder items in list
   * POST /api/v1/trips/:tripId/lists/:listId/reorder
   */
  fastify.post(
    '/trips/:tripId/lists/:listId/reorder',
    {
      preHandler: [authenticate, validateParams(listIdSchema), validateBody(reorderItemsSchema)],
    },
    asyncHandler(async (request, reply) => {
      await checkTripAccess(request.params.tripId, request.user.userId);

      const existingList = await listQueries.findById(request.params.listId);
      if (!existingList || existingList.tripId !== request.params.tripId) {
        throw new NotFoundError('List');
      }

      const list = await listQueries.reorderItems(request.params.listId, request.body.itemIds);
      reply.send(list);
    })
  );
}
