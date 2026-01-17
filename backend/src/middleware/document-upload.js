/**
 * T229: Document upload middleware
 * Handles document file uploads (PDFs, images, etc.) for trip documents
 */

import path from 'path';
import { pipeline } from 'stream/promises';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import crypto from 'crypto';

// Configuration
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (matches database constraint)
const ALLOWED_MIME_TYPES = [
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // Images
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  // Text
  'text/plain',
];
const ALLOWED_EXTENSIONS = [
  '.pdf', '.doc', '.docx',
  '.jpg', '.jpeg', '.png', '.webp', '.gif',
  '.txt',
];
const UPLOAD_DIR = process.env.DOCUMENT_UPLOAD_DIR || './uploads/documents';

/**
 * Validate file extension
 * @param {string} filename - Original filename
 * @returns {boolean} True if extension is allowed
 */
export function isValidDocumentExtension(filename) {
  const ext = path.extname(filename).toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

/**
 * Validate MIME type
 * @param {string} mimetype - File MIME type
 * @returns {boolean} True if MIME type is allowed
 */
export function isValidDocumentMimeType(mimetype) {
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
export async function ensureDocumentUploadDir(dir = UPLOAD_DIR) {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

/**
 * Save uploaded document to disk
 * @param {Object} fileData - File data from @fastify/multipart
 * @param {string} uploadDir - Target directory
 * @returns {Promise<Object>} File information
 */
export async function saveDocumentFile(fileData, uploadDir = UPLOAD_DIR) {
  if (!fileData) {
    throw new Error('No file provided');
  }

  const { file, filename, mimetype } = fileData;

  // Validate MIME type
  if (!isValidDocumentMimeType(mimetype)) {
    throw new Error(
      `Invalid file type: ${mimetype}. Allowed types: PDF, Word documents, images, and text files.`
    );
  }

  // Validate file extension
  if (!isValidDocumentExtension(filename)) {
    throw new Error(
      `Invalid file extension. Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}`
    );
  }

  // Ensure upload directory exists
  await ensureDocumentUploadDir(uploadDir);

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
    } catch {
      // Ignore unlink errors
    }
    throw error;
  }

  return {
    filename: uniqueFilename,
    originalFilename: filename,
    filepath,
    mimetype,
    size: fileSize,
  };
}

/**
 * Delete uploaded document
 * @param {string} filepath - Path to file
 * @returns {Promise<void>}
 */
export async function deleteDocumentFile(filepath) {
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
 * Get human-readable file size
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get file category icon based on mime type
 * @param {string} mimeType - File MIME type
 * @returns {string} Icon name/class
 */
export function getFileIcon(mimeType) {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'doc';
  if (mimeType === 'text/plain') return 'text';
  return 'file';
}

export default {
  saveDocumentFile,
  deleteDocumentFile,
  isValidDocumentExtension,
  isValidDocumentMimeType,
  formatFileSize,
  getFileIcon,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
};
