// T024: Cover Image Service - Pexels API integration with Sharp optimization
import https from 'https';
import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import sharp from 'sharp';

/**
 * Cover Image Service
 * Fetches destination-based images from Pexels API
 * Optimizes with Sharp (max 1200x630px)
 * Implements rate limiting (200 req/hour free tier)
 */
export class CoverImageService {
  constructor() {
    // Pexels API configuration
    this.apiKey = process.env.PEXELS_API_KEY;
    this.apiBaseUrl = 'https://api.pexels.com/v1';

    // Rate limiting: 200 requests/hour = ~3.33 req/min
    this.maxRequestsPerHour = 200;
    this.requestWindow = 60 * 60 * 1000; // 1 hour in ms
    this.requestTimestamps = [];

    // Image optimization settings
    this.targetWidth = 1200;
    this.targetHeight = 630;
    this.quality = 85;

    // Upload directory
    this.uploadDir = process.env.UPLOAD_DIR || '/app/uploads/covers';

    if (!this.apiKey) {
      console.warn('PEXELS_API_KEY not set - cover image service will use placeholder fallback');
    }
  }

  /**
   * Fetch cover image for destination
   * @param {string} destination - Destination name (from destination_data.display_name)
   * @param {Object} options - Options
   * @param {string} options.tripId - Trip ID for filename
   * @returns {Promise<Object>} - { url, attribution, source }
   */
  async fetchCoverImage(destination, options = {}) {
    const { tripId } = options;

    // Check API key
    if (!this.apiKey) {
      throw new Error('PEXELS_API_NOT_CONFIGURED');
    }

    // Check rate limit
    await this._checkRateLimit();

    // Search for image
    const searchQuery = this._buildSearchQuery(destination);
    const photos = await this._searchPexels(searchQuery);

    if (!photos || photos.length === 0) {
      throw new Error('NO_IMAGES_FOUND');
    }

    // Select best image (first result, medium quality)
    const photo = photos[0];
    const imageUrl = photo.src.large2x; // 1920x1280 or similar

    // Download and optimize image
    const localPath = await this._downloadAndOptimize(imageUrl, tripId);

    // Build attribution metadata
    const attribution = {
      source: 'pexels',
      photographer: photo.photographer,
      photographerUrl: photo.photographer_url,
      photoUrl: photo.url,
      photoId: photo.id,
    };

    return {
      url: localPath,
      attribution,
      source: 'pexels',
    };
  }

  /**
   * Build search query for Pexels
   * Uses the country name for broader, more scenic results
   * @param {string} destination - Destination name (e.g., "Tokyo, Japan" or "Paris, Île-de-France, France")
   * @returns {string} - Search query
   * @private
   */
  _buildSearchQuery(destination) {
    // Extract country (last part of comma-separated destination)
    // e.g., "Tokyo, Japan" -> "Japan"
    // e.g., "Paris, Île-de-France, France" -> "France"
    const parts = destination.split(',').map(p => p.trim());
    const country = parts[parts.length - 1] || parts[0];

    // Add travel context keywords to get scenic country images
    return `${country}`;
  }

  /**
   * Search Pexels API
   * @param {string} query - Search query
   * @returns {Promise<Array>} - Array of photo objects sorted by popularity
   * @private
   */
  async _searchPexels(query) {
    // Request photos sorted by popularity (Pexels default is by relevance, but popular photos come first)
    const url = `${this.apiBaseUrl}/search?query=${encodeURIComponent(query)}&per_page=15&orientation=landscape`;

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': this.apiKey,
        },
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('RATE_LIMIT_EXCEEDED');
        }
        throw new Error(`PEXELS_API_ERROR: ${response.status}`);
      }

      const data = await response.json();

      // Filter out flags and banners, then sort by popularity (liked)
      const photos = data.photos || [];
      const filteredPhotos = photos.filter(photo => {
        const alt = (photo.alt || '').toLowerCase();
        return !alt.includes('flag') && !alt.includes('banner');
      });

      // Sort by popularity (liked count) - most popular first
      filteredPhotos.sort((a, b) => (b.liked || 0) - (a.liked || 0));

      // Return the most popular photo
      return filteredPhotos.slice(0, 1);

    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('REQUEST_TIMEOUT');
      }
      throw error;
    }
  }

  /**
   * Download image and optimize with Sharp
   * @param {string} imageUrl - Source image URL
   * @param {string} tripId - Trip ID for filename
   * @returns {Promise<string>} - Local file path (relative to uploads dir)
   * @private
   */
  async _downloadAndOptimize(imageUrl, tripId) {
    const filename = `${tripId}-${Date.now()}.jpg`;
    const filePath = join(this.uploadDir, filename);

    // Ensure upload directory exists
    await mkdir(dirname(filePath), { recursive: true });

    // Download image
    const imageBuffer = await this._downloadImage(imageUrl);

    // Optimize with Sharp
    await sharp(imageBuffer)
      .resize(this.targetWidth, this.targetHeight, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality: this.quality })
      .toFile(filePath);

    // Return relative path for database storage
    return `/uploads/covers/${filename}`;
  }

  /**
   * Download image to buffer
   * @param {string} url - Image URL
   * @returns {Promise<Buffer>} - Image buffer
   * @private
   */
  async _downloadImage(url) {
    return new Promise((resolve, reject) => {
      https.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download image: ${response.statusCode}`));
          return;
        }

        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      }).on('error', reject);
    });
  }

  /**
   * Check rate limit (200 req/hour)
   * @private
   */
  async _checkRateLimit() {
    const now = Date.now();

    // Remove timestamps older than 1 hour
    this.requestTimestamps = this.requestTimestamps.filter(
      (timestamp) => now - timestamp < this.requestWindow
    );

    // Check if limit exceeded
    if (this.requestTimestamps.length >= this.maxRequestsPerHour) {
      throw new Error('RATE_LIMIT_EXCEEDED');
    }

    // Record this request
    this.requestTimestamps.push(now);
  }

  /**
   * Get rate limit statistics
   * @returns {Object} - Rate limit stats
   */
  getRateLimitStats() {
    const now = Date.now();
    const recentRequests = this.requestTimestamps.filter(
      (timestamp) => now - timestamp < this.requestWindow
    );

    return {
      requestsInLastHour: recentRequests.length,
      maxRequestsPerHour: this.maxRequestsPerHour,
      remaining: Math.max(0, this.maxRequestsPerHour - recentRequests.length),
    };
  }
}

/**
 * Singleton instance
 */
let coverImageServiceInstance;

/**
 * Get cover image service instance (singleton)
 * @returns {CoverImageService}
 */
export function getCoverImageService() {
  if (!coverImageServiceInstance) {
    coverImageServiceInstance = new CoverImageService();
  }
  return coverImageServiceInstance;
}
