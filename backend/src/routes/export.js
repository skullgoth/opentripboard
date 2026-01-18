// US9: Export and sharing routes
import { asyncHandler, NotFoundError, ForbiddenError, ValidationError } from '../middleware/error-handler.js';
import { validateBody } from '../middleware/validation.js';
import { findById as findTripById } from '../db/queries/trips.js';
import { findByTripId as findActivitiesByTripId } from '../db/queries/activities.js';
import { findByTripId as findTripBuddiesByTripId, hasAccess } from '../db/queries/trip-buddies.js';
import { findByTripId as findExpensesByTripId, getSummary as getExpenseSummary } from '../db/queries/expenses.js';
import { findByTripId as findListsByTripId } from '../db/queries/lists.js';
import {
  createShareToken,
  findByToken,
  findByTripId as findShareTokensByTripId,
  deleteShareToken,
  updatePermission,
} from '../db/queries/share-tokens.js';
import { generateTripPDF } from '../services/pdf-generator.js';

// Validation schemas
const createShareTokenSchema = {
  type: 'object',
  properties: {
    expiresIn: {
      type: 'string',
      enum: ['1d', '7d', '30d', 'never'],
      default: 'never',
    },
  },
  additionalProperties: false,
};

const updateShareTokenSchema = {
  type: 'object',
  required: ['permission'],
  properties: {
    permission: {
      type: 'string',
      enum: ['view'],
    },
  },
  additionalProperties: false,
};

/**
 * Calculate expiration date from duration string
 */
function calculateExpiration(expiresIn) {
  if (!expiresIn || expiresIn === 'never') return null;

  const now = new Date();
  switch (expiresIn) {
    case '1d':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case '7d':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}

export default async function exportRoutes(fastify) {
  // =============================================
  // PDF EXPORT
  // =============================================

  /**
   * Export trip to PDF
   */
  fastify.get(
    '/trips/:tripId/export/pdf',
    {
      preHandler: fastify.auth,
    },
    asyncHandler(async (request, reply) => {
      const { tripId } = request.params;
      const userId = request.user.userId;

      // Check trip exists and user has access
      const trip = await findTripById(tripId);
      if (!trip) {
        throw new NotFoundError('Trip not found');
      }

      // Check access (owner or trip buddy)
      const isOwner = trip.owner_id === userId;
      const isBuddy = await hasAccess(tripId, userId);
      if (!isOwner && !isBuddy) {
        throw new ForbiddenError('You do not have access to this trip');
      }

      // Get all trip data
      const [activities, tripBuddies, expenses, expenseSummary, lists] = await Promise.all([
        findActivitiesByTripId(tripId),
        findTripBuddiesByTripId(tripId),
        findExpensesByTripId(tripId),
        getExpenseSummary(tripId),
        findListsByTripId(tripId),
      ]);

      // Generate PDF with all data
      const pdfBuffer = await generateTripPDF(trip, activities, tripBuddies, {
        expenses,
        expenseSummary,
        lists,
      });

      // Set response headers for PDF download
      const filename = `${trip.name.replace(/[^a-z0-9]/gi, '_')}_itinerary.pdf`;
      reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .header('Content-Length', pdfBuffer.length)
        .send(pdfBuffer);
    })
  );

  /**
   * Export trip to JSON
   */
  fastify.get(
    '/trips/:tripId/export/json',
    {
      preHandler: fastify.auth,
    },
    asyncHandler(async (request, reply) => {
      const { tripId } = request.params;
      const userId = request.user.userId;

      // Check trip exists and user has access
      const trip = await findTripById(tripId);
      if (!trip) {
        throw new NotFoundError('Trip not found');
      }

      // Check access (owner or trip buddy)
      const isOwner = trip.owner_id === userId;
      const isBuddy = await hasAccess(tripId, userId);
      if (!isOwner && !isBuddy) {
        throw new ForbiddenError('You do not have access to this trip');
      }

      // Get all trip data
      const [activities, tripBuddies, expenses, expenseSummary, lists] = await Promise.all([
        findActivitiesByTripId(tripId),
        findTripBuddiesByTripId(tripId),
        findExpensesByTripId(tripId),
        getExpenseSummary(tripId),
        findListsByTripId(tripId),
      ]);

      // Build JSON export data
      const exportData = {
        trip: {
          id: trip.id,
          name: trip.name,
          destination: trip.destination,
          startDate: trip.start_date,
          endDate: trip.end_date,
          coverImageUrl: trip.cover_image_url,
          budget: trip.budget,
          currency: trip.currency,
          createdAt: trip.created_at,
          updatedAt: trip.updated_at,
        },
        activities: activities.map((a) => ({
          id: a.id,
          title: a.title,
          type: a.type,
          startTime: a.start_time,
          endTime: a.end_time,
          location: a.location,
          latitude: a.latitude,
          longitude: a.longitude,
          description: a.description,
          metadata: a.metadata,
          orderIndex: a.order_index,
          createdAt: a.created_at,
        })),
        tripBuddies: tripBuddies.map((b) => ({
          userId: b.user_id,
          name: b.full_name,
          email: b.email,
          role: b.role,
          joinedAt: b.created_at,
        })),
        expenses: expenses.map((e) => ({
          id: e.id,
          description: e.description,
          amount: e.amount,
          currency: e.currency,
          category: e.category,
          paidBy: e.paid_by_name,
          date: e.expense_date,
          createdAt: e.created_at,
        })),
        expenseSummary: {
          totalAmount: expenseSummary.total_amount,
          currency: expenseSummary.currency,
          expenseCount: expenseSummary.expense_count,
        },
        lists: lists.map((l) => ({
          id: l.id,
          title: l.title,
          items: l.items,
          createdAt: l.created_at,
          updatedAt: l.updated_at,
        })),
        exportedAt: new Date().toISOString(),
      };

      // Set response headers for JSON download
      const filename = `${trip.name.replace(/[^a-z0-9]/gi, '_')}_export.json`;
      reply
        .header('Content-Type', 'application/json')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(exportData);
    })
  );

  // =============================================
  // SHARE LINKS
  // =============================================

  /**
   * Create a share link for a trip
   */
  fastify.post(
    '/trips/:tripId/share',
    {
      preHandler: [fastify.auth, validateBody(createShareTokenSchema)],
    },
    asyncHandler(async (request, reply) => {
      const { tripId } = request.params;
      const { expiresIn = 'never' } = request.body;
      const userId = request.user.userId;

      // Check trip exists
      const trip = await findTripById(tripId);
      if (!trip) {
        throw new NotFoundError('Trip not found');
      }

      // Check user has access to the trip (owner or trip buddy)
      const isOwner = trip.owner_id === userId;
      if (!isOwner) {
        const isMember = await hasAccess(tripId, userId);
        if (!isMember) {
          throw new ForbiddenError('You do not have access to this trip');
        }
      }

      // Calculate expiration
      const expiresAt = calculateExpiration(expiresIn);

      // Create share token (always view-only)
      const shareToken = await createShareToken({
        tripId,
        createdBy: userId,
        permission: 'view',
        expiresAt,
      });

      // Build share URL
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const shareUrl = `${baseUrl}/#/shared/${shareToken.token}`;

      reply.code(201).send({
        shareToken: {
          id: shareToken.id,
          token: shareToken.token,
          permission: shareToken.permission,
          expiresAt: shareToken.expires_at,
          createdAt: shareToken.created_at,
          shareUrl,
        },
      });
    })
  );

  /**
   * List all share links for a trip
   */
  fastify.get(
    '/trips/:tripId/share',
    {
      preHandler: fastify.auth,
    },
    asyncHandler(async (request, reply) => {
      const { tripId } = request.params;
      const userId = request.user.userId;

      // Check trip exists and user is owner
      const trip = await findTripById(tripId);
      if (!trip) {
        throw new NotFoundError('Trip not found');
      }

      if (trip.owner_id !== userId) {
        throw new ForbiddenError('Only trip owner can view share links');
      }

      const tokens = await findShareTokensByTripId(tripId);
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

      reply.send({
        shareTokens: tokens.map((t) => ({
          id: t.id,
          token: t.token,
          permission: t.permission,
          expiresAt: t.expires_at,
          createdAt: t.created_at,
          createdBy: {
            name: t.created_by_name,
            email: t.created_by_email,
          },
          shareUrl: `${baseUrl}/#/shared/${t.token}`,
        })),
      });
    })
  );

  /**
   * Update share link permission
   */
  fastify.patch(
    '/trips/:tripId/share/:tokenId',
    {
      preHandler: [fastify.auth, validateBody(updateShareTokenSchema)],
    },
    asyncHandler(async (request, reply) => {
      const { tripId, tokenId } = request.params;
      const { permission } = request.body;
      const userId = request.user.userId;

      // Check trip exists and user is owner
      const trip = await findTripById(tripId);
      if (!trip) {
        throw new NotFoundError('Trip not found');
      }

      if (trip.owner_id !== userId) {
        throw new ForbiddenError('Only trip owner can modify share links');
      }

      const updated = await updatePermission(tokenId, tripId, permission);
      if (!updated) {
        throw new NotFoundError('Share link not found');
      }

      reply.send({
        shareToken: {
          id: updated.id,
          permission: updated.permission,
          updatedAt: updated.updated_at,
        },
      });
    })
  );

  /**
   * Delete a share link
   */
  fastify.delete(
    '/trips/:tripId/share/:tokenId',
    {
      preHandler: fastify.auth,
    },
    asyncHandler(async (request, reply) => {
      const { tripId, tokenId } = request.params;
      const userId = request.user.userId;

      // Check trip exists and user is owner
      const trip = await findTripById(tripId);
      if (!trip) {
        throw new NotFoundError('Trip not found');
      }

      if (trip.owner_id !== userId) {
        throw new ForbiddenError('Only trip owner can delete share links');
      }

      const deleted = await deleteShareToken(tokenId, tripId);
      if (!deleted) {
        throw new NotFoundError('Share link not found');
      }

      reply.code(204).send();
    })
  );

  // =============================================
  // PUBLIC SHARE ACCESS
  // =============================================

  /**
   * Get shared trip by token (public - no auth required)
   */
  fastify.get(
    '/shared/:token',
    asyncHandler(async (request, reply) => {
      const { token } = request.params;

      // Find token and validate
      const shareData = await findByToken(token);
      if (!shareData) {
        throw new NotFoundError('Share link not found or expired');
      }

      // Get activities
      const activities = await findActivitiesByTripId(shareData.trip_id);

      // Get trip buddies (for display)
      const tripBuddies = await findTripBuddiesByTripId(shareData.trip_id);

      reply.send({
        trip: {
          id: shareData.trip_id,
          name: shareData.trip_name,
          destination: shareData.destination,
          startDate: shareData.start_date,
          endDate: shareData.end_date,
          coverImageUrl: shareData.cover_image_url,
          budget: shareData.budget,
          currency: shareData.currency,
          owner: {
            name: shareData.owner_name,
          },
        },
        activities: activities.map((a) => ({
          id: a.id,
          title: a.title,
          type: a.type,
          date: a.start_time ? new Date(a.start_time).toISOString().split('T')[0] : null,
          startTime: a.start_time,
          endTime: a.end_time,
          location: a.location,
          latitude: a.latitude,
          longitude: a.longitude,
          notes: a.description,
          metadata: a.metadata,
          orderIndex: a.order_index,
        })),
        tripBuddies: tripBuddies.map((b) => ({
          name: b.full_name,
          role: b.role,
        })),
        permission: shareData.permission,
        expiresAt: shareData.expires_at,
      });
    })
  );
}
