/**
 * T090: Image upload middleware using @fastify/multipart
 * Handles multipart/form-data uploads with file size and format validation
 */

import path from 'path';
import { pipeline } from 'stream/promises';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import crypto from 'crypto';

// Configuration
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads/cover-images';

/**
 * Validate file extension
 * @param {string} filename - Original filename
 * @returns {boolean} True if extension is allowed
 */
export function isValidFileExtension(filename) {
  const ext = path.extname(filename).toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

/**
 * Validate MIME type
 * @param {string} mimetype - File MIME type
 * @returns {boolean} True if MIME type is allowed
 */
export function isValidMimeType(mimetype) {
  return ALLOWED_MIME_TYPES.includes(mimetype);
}

/**
 * Generate unique filename
 * @param {string} originalFilename - Original filename
 * @returns {string} Unique filename with timestamp and random hash
 */
export function generateUniqueFilename(originalFilename) {
  const ext = path.extname(originalFilename).toLowerCase();
  const timestamp = Date.now();
  const randomHash = crypto.randomBytes(8).toString('hex');
  return `${timestamp}-${randomHash}${ext}`;
}

/**
 * Ensure upload directory exists
 * @param {string} dir - Directory path
 */
export async function ensureUploadDir(dir = UPLOAD_DIR) {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

/**
 * Save uploaded file to disk
 * @param {Object} fileData - File data from @fastify/multipart
 * @param {string} uploadDir - Target directory
 * @returns {Promise<Object>} File information
 */
export async function saveUploadedFile(fileData, uploadDir = UPLOAD_DIR) {
  // Validate file
  if (!fileData) {
    throw new Error('No file provided');
  }

  const { file, filename, mimetype, encoding } = fileData;

  // Validate MIME type
  if (!isValidMimeType(mimetype)) {
    throw new Error(
      `Invalid file type: ${mimetype}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`
    );
  }

  // Validate file extension
  if (!isValidFileExtension(filename)) {
    throw new Error(
      `Invalid file extension. Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}`
    );
  }

  // Ensure upload directory exists
  await ensureUploadDir(uploadDir);

  // Generate unique filename
  const uniqueFilename = generateUniqueFilename(filename);
  const filepath = path.join(uploadDir, uniqueFilename);

  // Save file to disk with size validation
  let fileSize = 0;
  const writeStream = createWriteStream(filepath);

  // Track file size during upload
  file.on('data', (chunk) => {
    fileSize += chunk.length;
    if (fileSize > MAX_FILE_SIZE) {
      writeStream.destroy();
      file.destroy();
      throw new Error(
        `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`
      );
    }
  });

  try {
    await pipeline(file, writeStream);
  } catch (error) {
    // Clean up partial file on error
    try {
      await fs.unlink(filepath);
    } catch (unlinkError) {
      // Ignore unlink errors
    }
    throw error;
  }

  return {
    filename: uniqueFilename,
    originalFilename: filename,
    filepath,
    mimetype,
    encoding,
    size: fileSize,
  };
}

/**
 * Delete uploaded file
 * @param {string} filepath - Path to file
 * @returns {Promise<void>}
 */
export async function deleteUploadedFile(filepath) {
  try {
    await fs.unlink(filepath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
    // File doesn't exist, ignore
  }
}

/**
 * Fastify plugin to configure multipart support
 * @param {Object} fastify - Fastify instance
 * @param {Object} opts - Plugin options
 */
export async function uploadPlugin(fastify, opts = {}) {
  // Register @fastify/multipart with configuration
  await fastify.register(import('@fastify/multipart'), {
    limits: {
      fileSize: opts.maxFileSize || MAX_FILE_SIZE,
      files: opts.maxFiles || 1,
    },
  });
}

export default uploadPlugin;
