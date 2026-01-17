/**
 * T091: Image processing service using sharp
 * Handles image resize, optimization, and format conversion
 */

import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';

// Configuration
const COVER_IMAGE_WIDTH = 1200;
const COVER_IMAGE_HEIGHT = 630;
const THUMBNAIL_WIDTH = 400;
const THUMBNAIL_HEIGHT = 210;
const JPEG_QUALITY = 85;
const WEBP_QUALITY = 85;
const PNG_COMPRESSION_LEVEL = 8;

/**
 * Process cover image: resize, optimize, and convert format
 * @param {string} inputPath - Path to input image
 * @param {string} outputPath - Path to save processed image
 * @param {Object} options - Processing options
 * @param {number} options.width - Target width (default: 1200)
 * @param {number} options.height - Target height (default: 630)
 * @param {string} options.format - Output format: 'jpeg', 'png', 'webp' (default: 'jpeg')
 * @param {number} options.quality - Quality 1-100 (default: 85)
 * @returns {Promise<Object>} Processed image info
 */
export async function processCoverImage(
  inputPath,
  outputPath,
  options = {}
) {
  const {
    width = COVER_IMAGE_WIDTH,
    height = COVER_IMAGE_HEIGHT,
    format = 'jpeg',
    quality = JPEG_QUALITY,
  } = options;

  try {
    const image = sharp(inputPath);

    // Get metadata
    const metadata = await image.metadata();

    // Resize image with cover fit (crop to fill dimensions)
    let pipeline = image.resize(width, height, {
      fit: 'cover',
      position: 'center',
    });

    // Apply format-specific optimization
    switch (format.toLowerCase()) {
      case 'jpeg':
      case 'jpg':
        pipeline = pipeline.jpeg({ quality, mozjpeg: true });
        break;
      case 'png':
        pipeline = pipeline.png({
          compressionLevel: PNG_COMPRESSION_LEVEL,
          quality,
        });
        break;
      case 'webp':
        pipeline = pipeline.webp({ quality });
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    // Save processed image
    const info = await pipeline.toFile(outputPath);

    return {
      width: info.width,
      height: info.height,
      format: info.format,
      size: info.size,
      originalWidth: metadata.width,
      originalHeight: metadata.height,
      originalFormat: metadata.format,
    };
  } catch (error) {
    throw new Error(`Failed to process cover image: ${error.message}`);
  }
}

/**
 * Generate thumbnail from cover image
 * @param {string} inputPath - Path to input image
 * @param {string} outputPath - Path to save thumbnail
 * @param {Object} options - Thumbnail options
 * @param {number} options.width - Thumbnail width (default: 400)
 * @param {number} options.height - Thumbnail height (default: 210)
 * @param {string} options.format - Output format (default: 'jpeg')
 * @returns {Promise<Object>} Thumbnail info
 */
export async function generateThumbnail(
  inputPath,
  outputPath,
  options = {}
) {
  const {
    width = THUMBNAIL_WIDTH,
    height = THUMBNAIL_HEIGHT,
    format = 'jpeg',
  } = options;

  try {
    const image = sharp(inputPath);

    let pipeline = image.resize(width, height, {
      fit: 'cover',
      position: 'center',
    });

    // Apply format-specific settings
    if (format === 'jpeg' || format === 'jpg') {
      pipeline = pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true });
    } else if (format === 'webp') {
      pipeline = pipeline.webp({ quality: WEBP_QUALITY });
    } else if (format === 'png') {
      pipeline = pipeline.png({ compressionLevel: PNG_COMPRESSION_LEVEL });
    }

    const info = await pipeline.toFile(outputPath);

    return {
      width: info.width,
      height: info.height,
      format: info.format,
      size: info.size,
    };
  } catch (error) {
    throw new Error(`Failed to generate thumbnail: ${error.message}`);
  }
}

/**
 * Optimize image without resizing (useful for already-sized images)
 * @param {string} inputPath - Path to input image
 * @param {string} outputPath - Path to save optimized image
 * @param {Object} options - Optimization options
 * @param {string} options.format - Output format (default: auto-detect)
 * @param {number} options.quality - Quality 1-100 (default: 85)
 * @returns {Promise<Object>} Optimized image info
 */
export async function optimizeImage(inputPath, outputPath, options = {}) {
  const { format, quality = 85 } = options;

  try {
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    const targetFormat = format || metadata.format;
    let pipeline = image;

    // Apply format-specific optimization
    switch (targetFormat) {
      case 'jpeg':
      case 'jpg':
        pipeline = pipeline.jpeg({ quality, mozjpeg: true });
        break;
      case 'png':
        pipeline = pipeline.png({
          compressionLevel: PNG_COMPRESSION_LEVEL,
          quality,
        });
        break;
      case 'webp':
        pipeline = pipeline.webp({ quality });
        break;
      default:
        throw new Error(`Unsupported format: ${targetFormat}`);
    }

    const info = await pipeline.toFile(outputPath);

    return {
      width: info.width,
      height: info.height,
      format: info.format,
      size: info.size,
      originalSize: metadata.size || 0,
      savings: metadata.size ? Math.round((1 - info.size / metadata.size) * 100) : 0,
    };
  } catch (error) {
    throw new Error(`Failed to optimize image: ${error.message}`);
  }
}

/**
 * Get image metadata
 * @param {string} imagePath - Path to image
 * @returns {Promise<Object>} Image metadata
 */
export async function getImageMetadata(imagePath) {
  try {
    const metadata = await sharp(imagePath).metadata();
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      space: metadata.space,
      channels: metadata.channels,
      depth: metadata.depth,
      density: metadata.density,
      hasAlpha: metadata.hasAlpha,
      orientation: metadata.orientation,
    };
  } catch (error) {
    throw new Error(`Failed to get image metadata: ${error.message}`);
  }
}

/**
 * Validate image dimensions and format
 * @param {string} imagePath - Path to image
 * @param {Object} constraints - Validation constraints
 * @param {number} constraints.minWidth - Minimum width
 * @param {number} constraints.minHeight - Minimum height
 * @param {number} constraints.maxWidth - Maximum width
 * @param {number} constraints.maxHeight - Maximum height
 * @param {string[]} constraints.allowedFormats - Allowed formats
 * @returns {Promise<Object>} Validation result
 */
export async function validateImage(imagePath, constraints = {}) {
  try {
    const metadata = await getImageMetadata(imagePath);
    const errors = [];

    if (constraints.minWidth && metadata.width < constraints.minWidth) {
      errors.push(
        `Image width (${metadata.width}px) is less than minimum (${constraints.minWidth}px)`
      );
    }

    if (constraints.maxWidth && metadata.width > constraints.maxWidth) {
      errors.push(
        `Image width (${metadata.width}px) exceeds maximum (${constraints.maxWidth}px)`
      );
    }

    if (constraints.minHeight && metadata.height < constraints.minHeight) {
      errors.push(
        `Image height (${metadata.height}px) is less than minimum (${constraints.minHeight}px)`
      );
    }

    if (constraints.maxHeight && metadata.height > constraints.maxHeight) {
      errors.push(
        `Image height (${metadata.height}px) exceeds maximum (${constraints.maxHeight}px)`
      );
    }

    if (
      constraints.allowedFormats &&
      !constraints.allowedFormats.includes(metadata.format)
    ) {
      errors.push(
        `Image format (${metadata.format}) is not allowed. Allowed formats: ${constraints.allowedFormats.join(', ')}`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      metadata,
    };
  } catch (error) {
    return {
      valid: false,
      errors: [`Failed to validate image: ${error.message}`],
      metadata: null,
    };
  }
}

/**
 * Delete image file
 * @param {string} imagePath - Path to image
 * @returns {Promise<void>}
 */
export async function deleteImage(imagePath) {
  try {
    await fs.unlink(imagePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw new Error(`Failed to delete image: ${error.message}`);
    }
    // File doesn't exist, ignore
  }
}
