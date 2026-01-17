
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { Readable } from 'node:stream';

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

import { Readable } from 'node:stream';

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

// Mock node:fs/promises module
vi.mock('node:fs/promises', () => ({
  default: {
    access: vi.fn(),
    open: vi.fn(() => ({
      createReadStream: vi.fn(() => {
        const mockStream = new Readable();
        mockStream.push('mock file content');
        mockStream.push(null); // No more data
        return mockStream;
      }),
      close: vi.fn(),
    })),
  },
}));

describe('Documents Routes', () => {
  let app;
  let documentQueries;
  let tripQueries;
  let tripBuddyQueries;
  let activityQueries;
  let documentUpload;
  let fs;

  beforeEach(async () => {
    vi.resetModules(); // Reset modules to allow re-importing with fresh mocks

    // Mock services and middleware using vi.doMock
    vi.doMock('../../../src/db/queries/documents.js', () => ({
      findByTripId: vi.fn(),
      getCategoryCounts: vi.fn(),
      getTripStorageUsage: vi.fn(),
      create: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
      deleteDocument: vi.fn(),
      findByActivityId: vi.fn(),
    }));

    vi.doMock('../../../src/db/queries/trips.js', () => ({
      findById: vi.fn(),
    }));

    vi.doMock('../../../src/db/queries/trip-buddies.js', () => ({
      findByTripAndUser: vi.fn(),
    }));

    vi.doMock('../../../src/db/queries/activities.js', () => ({
      findById: vi.fn(),
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
      ValidationError: class ValidationError extends Error {
        constructor(message) { super(message); this.statusCode = 400; }
      },
    }));

    vi.doMock('../../../src/middleware/document-upload.js', () => ({
      saveDocumentFile: vi.fn(),
      deleteDocumentFile: vi.fn(),
    }));

    // Dynamically import the router and mocked service after mocks are in place
    const documentRoutes = (await import('../../../src/routes/documents.js')).default;
    documentQueries = await import('../../../src/db/queries/documents.js');
    tripQueries = await import('../../../src/db/queries/trips.js');
    tripBuddyQueries = await import('../../../src/db/queries/trip-buddies.js');
    activityQueries = await import('../../../src/db/queries/activities.js');
    documentUpload = await import('../../../src/middleware/document-upload.js');
    fs = (await import('node:fs/promises')).default;

    app = Fastify();
    await app.register(import('@fastify/multipart')); // Add multipart plugin
    app.register(documentRoutes);
  });

  describe('GET /trips/:tripId/documents', () => {
    it('should return all documents for a trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockDocuments = [
        { id: 'doc-1', fileName: 'passport.pdf', tripId: 'trip-123' },
      ];

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      documentQueries.findByTripId.mockResolvedValue(mockDocuments);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/documents',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(mockDocuments);
      expect(documentQueries.findByTripId).toHaveBeenCalledWith('trip-123', {});
    });

    it('should return 404 if trip not found', async () => {
      tripQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/documents',
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
        url: '/trips/trip-123/documents',
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.payload).error).toBe('You do not have access to this trip');
    });
  });

  describe('GET /trips/:tripId/documents/stats', () => {
    it('should return document category counts and storage usage for a trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockCategoryCounts = { passport: 2, photo: 5, other: 1 };
      const mockStorageUsage = 1024 * 1024 * 50; // 50MB

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      documentQueries.getCategoryCounts.mockResolvedValue(mockCategoryCounts);
      documentQueries.getTripStorageUsage.mockResolvedValue(mockStorageUsage);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/documents/stats',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({
        categoryCounts: mockCategoryCounts,
        storageUsage: mockStorageUsage,
        totalDocuments: 8,
      });
      expect(documentQueries.getCategoryCounts).toHaveBeenCalledWith('trip-123');
      expect(documentQueries.getTripStorageUsage).toHaveBeenCalledWith('trip-123');
    });

    it('should return 404 if trip not found', async () => {
      tripQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/documents/stats',
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
        url: '/trips/trip-123/documents/stats',
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.payload).error).toBe('You do not have access to this trip');
    });
  });

  describe('POST /trips/:tripId/documents', () => {
    it('should upload a document', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockActivity = { id: 'act-1', trip_id: 'trip-123' };
      const mockDocument = {
        id: 'doc-new',
        tripId: 'trip-123',
        fileName: 'test.pdf',
        fileSize: 1000,
        fileType: 'application/pdf',
        filePath: './uploads/documents/test.pdf',
        category: 'other',
        description: null,
      };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      activityQueries.findById.mockResolvedValue(mockActivity);
      documentUpload.saveDocumentFile.mockResolvedValue({
        originalFilename: 'test.pdf',
        size: 1000,
        mimetype: 'application/pdf',
        filepath: './uploads/documents/test.pdf',
      });
      documentQueries.create.mockResolvedValue(mockDocument);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/documents',
        headers: { 'Content-Type': 'multipart/form-data; boundary=boundary' },
        payload: '--boundary\r\n' +
          'Content-Disposition: form-data; name="file"; filename="test.pdf"\r\n' +
          'Content-Type: application/pdf\r\n\r\n' +
          'file content\r\n' +
          '--boundary--\r\n',
      });

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.payload)).toEqual(mockDocument);
      expect(documentQueries.create).toHaveBeenCalledWith(
        expect.objectContaining({ fileName: 'test.pdf' })
      );
    });

    it('should return 400 if no file is provided', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/documents',
        headers: { 'Content-Type': 'multipart/form-data; boundary=boundary' },
        payload: '--boundary--\r\n', // No file part
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload).error).toBe('No file provided');
    });

    it('should return 400 if invalid activity ID is provided', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      activityQueries.findById.mockResolvedValue(null); // Activity not found

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/documents',
        headers: { 'Content-Type': 'multipart/form-data; boundary=boundary' },
        payload: '--boundary\r\n' +
          'Content-Disposition: form-data; name="activityId"\r\n\r\n' +
          'invalid-activity-id\r\n' +
          '--boundary\r\n' +
          'Content-Disposition: form-data; name="file"; filename="test.pdf"\r\n' +
          'Content-Type: application/pdf\r\n\r\n' +
          'file content\r\n' +
          '--boundary--\r\n',
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload).error).toBe('Invalid activity ID');
    });

    it('should return 404 if trip not found', async () => {
      tripQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/documents',
        headers: { 'Content-Type': 'multipart/form-data; boundary=boundary' },
        payload: '--boundary\r\n' +
          'Content-Disposition: form-data; name="file"; filename="test.pdf"\r\n' +
          'Content-Type: application/pdf\r\n\r\n' +
          'file content\r\n' +
          '--boundary--\r\n',
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
        url: '/trips/trip-123/documents',
        headers: { 'Content-Type': 'multipart/form-data; boundary=boundary' },
        payload: '--boundary\r\n' +
          'Content-Disposition: form-data; name="file"; filename="test.pdf"\r\n' +
          'Content-Type: application/pdf\r\n\r\n' +
          'file content\r\n' +
          '--boundary--\r\n',
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.payload).error).toBe('You do not have access to this trip');
    });
  });

  describe('GET /trips/:tripId/documents/:documentId', () => {
    it('should return a specific document', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockDocument = { id: 'doc-1', fileName: 'passport.pdf', tripId: 'trip-123' };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      documentQueries.findById.mockResolvedValue(mockDocument);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/documents/doc-1',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(mockDocument);
      expect(documentQueries.findById).toHaveBeenCalledWith('doc-1');
    });

    it('should return 404 if trip not found', async () => {
      tripQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/documents/doc-1',
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
        url: '/trips/trip-123/documents/doc-1',
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.payload).error).toBe('You do not have access to this trip');
    });

    it('should return 404 if document not found for trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      documentQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/documents/doc-1',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Document');
    });

    it('should return 404 if document belongs to another trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockDocument = { id: 'doc-1', fileName: 'passport.pdf', tripId: 'another-trip' };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      documentQueries.findById.mockResolvedValue(mockDocument);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/documents/doc-1',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Document');
    });
  });

  describe('GET /trips/:tripId/documents/:documentId/download', () => {
    it('should download a specific document', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockDocument = {
        id: 'doc-1',
        fileName: 'passport.pdf',
        tripId: 'trip-123',
        fileType: 'application/pdf',
        fileSize: 12345,
        filePath: './uploads/documents/passport.pdf',
      };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      documentQueries.findById.mockResolvedValue(mockDocument);
      fs.access.mockResolvedValue(undefined); // File exists on disk

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/documents/doc-1/download',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toBe('attachment; filename="passport.pdf"');
      expect(response.headers['content-length']).toBe('12345');
      expect(documentQueries.findById).toHaveBeenCalledWith('doc-1');
      expect(fs.access).toHaveBeenCalledWith('./uploads/documents/passport.pdf');
    });

    it('should return 404 if trip not found', async () => {
      tripQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/documents/doc-1/download',
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
        url: '/trips/trip-123/documents/doc-1/download',
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.payload).error).toBe('You do not have access to this trip');
    });

    it('should return 404 if document not found for trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      documentQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/documents/doc-1/download',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Document');
    });

    it('should return 404 if document belongs to another trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockDocument = { id: 'doc-1', fileName: 'passport.pdf', tripId: 'another-trip' };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      documentQueries.findById.mockResolvedValue(mockDocument);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/documents/doc-1/download',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Document');
    });

    it('should return 404 if file not found on disk', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockDocument = {
        id: 'doc-1',
        fileName: 'passport.pdf',
        tripId: 'trip-123',
        fileType: 'application/pdf',
        fileSize: 12345,
        filePath: './uploads/documents/passport.pdf',
      };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      documentQueries.findById.mockResolvedValue(mockDocument);
      fs.access.mockRejectedValue(new Error('File not found')); // Simulate file not found on disk

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/documents/doc-1/download',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('File not found on disk');
    });
  });

  describe('PATCH /trips/:tripId/documents/:documentId', () => {
    it('should update a document', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockDocument = { id: 'doc-1', fileName: 'old.pdf', tripId: 'trip-123' };
      const updateData = { description: 'Updated description', category: 'ticket' };
      const mockUpdatedDocument = { ...mockDocument, ...updateData };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      documentQueries.findById.mockResolvedValue(mockDocument);
      documentQueries.update.mockResolvedValue(mockUpdatedDocument);

      const response = await app.inject({
        method: 'PATCH',
        url: '/trips/trip-123/documents/doc-1',
        payload: updateData,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(mockUpdatedDocument);
      expect(documentQueries.update).toHaveBeenCalledWith('doc-1', updateData);
    });

    it('should return 404 if trip not found', async () => {
      tripQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'PATCH',
        url: '/trips/trip-123/documents/doc-1',
        payload: { description: 'New' },
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
        url: '/trips/trip-123/documents/doc-1',
        payload: { description: 'New' },
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.payload).error).toBe('You do not have access to this trip');
    });

    it('should return 404 if document not found for trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      documentQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'PATCH',
        url: '/trips/trip-123/documents/doc-1',
        payload: { description: 'New' },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Document');
    });

    it('should return 404 if document belongs to another trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockDocument = { id: 'doc-1', fileName: 'passport.pdf', tripId: 'another-trip' };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      documentQueries.findById.mockResolvedValue(mockDocument);

      const response = await app.inject({
        method: 'PATCH',
        url: '/trips/trip-123/documents/doc-1',
        payload: { description: 'New' },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Document');
    });

    it('should return 400 if invalid activity ID is provided', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockDocument = { id: 'doc-1', fileName: 'passport.pdf', tripId: 'trip-123' };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      documentQueries.findById.mockResolvedValue(mockDocument);
      activityQueries.findById.mockResolvedValue(null); // Activity not found

      const response = await app.inject({
        method: 'PATCH',
        url: '/trips/trip-123/documents/doc-1',
        payload: { activityId: 'invalid-activity' },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload).error).toBe('Invalid activity ID');
    });
  });

  describe('DELETE /trips/:tripId/documents/:documentId', () => {
    it('should delete a document', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockDocument = {
        id: 'doc-1',
        fileName: 'passport.pdf',
        tripId: 'trip-123',
        filePath: './uploads/documents/passport.pdf',
      };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      documentQueries.findById.mockResolvedValue(mockDocument);
      documentQueries.deleteDocument.mockResolvedValue(mockDocument); // Return the deleted document for file path
      documentUpload.deleteDocumentFile.mockResolvedValue(undefined);

      const response = await app.inject({
        method: 'DELETE',
        url: '/trips/trip-123/documents/doc-1',
      });

      expect(response.statusCode).toBe(204);
      expect(documentQueries.deleteDocument).toHaveBeenCalledWith('doc-1');
      expect(documentUpload.deleteDocumentFile).toHaveBeenCalledWith('./uploads/documents/passport.pdf');
    });

    it('should return 404 if trip not found', async () => {
      tripQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'DELETE',
        url: '/trips/trip-123/documents/doc-1',
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
        url: '/trips/trip-123/documents/doc-1',
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.payload).error).toBe('You do not have access to this trip');
    });

    it('should return 404 if document not found for trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      documentQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'DELETE',
        url: '/trips/trip-123/documents/doc-1',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Document');
    });

    it('should return 404 if document belongs to another trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockDocument = { id: 'doc-1', fileName: 'passport.pdf', tripId: 'another-trip' };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      documentQueries.findById.mockResolvedValue(mockDocument);

      const response = await app.inject({
        method: 'DELETE',
        url: '/trips/trip-123/documents/doc-1',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Document');
    });
  });

  describe('GET /trips/:tripId/activities/:activityId/documents', () => {
    it('should return documents for a specific activity', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockActivity = { id: 'act-1', trip_id: 'trip-123' };
      const mockDocuments = [{ id: 'doc-1', fileName: 'activity_doc.pdf', activityId: 'act-1' }];

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      activityQueries.findById.mockResolvedValue(mockActivity);
      documentQueries.findByActivityId.mockResolvedValue(mockDocuments);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/activities/act-1/documents',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(mockDocuments);
      expect(documentQueries.findByActivityId).toHaveBeenCalledWith('act-1');
    });

    it('should return 404 if trip not found', async () => {
      tripQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/activities/act-1/documents',
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
        url: '/trips/trip-123/activities/act-1/documents',
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.payload).error).toBe('You do not have access to this trip');
    });

    it('should return 404 if activity not found for trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      activityQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/activities/act-1/documents',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Activity');
    });

    it('should return 404 if activity belongs to another trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockActivity = { id: 'act-1', trip_id: 'another-trip' };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.findByTripAndUser.mockResolvedValue({ accepted_at: new Date() });
      activityQueries.findById.mockResolvedValue(mockActivity);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/activities/act-1/documents',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Activity');
    });
  });
});
