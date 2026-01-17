// T007: Shared HTTP client utility for external APIs
// Provides common configuration for Nominatim and Pexels API calls

/**
 * HTTP client for Nominatim API (geocoding)
 * Enforces required User-Agent header per OSM usage policy
 */
export class NominatimClient {
  constructor() {
    this.baseUrl = 'https://nominatim.openstreetmap.org';
    this.userAgent = process.env.NOMINATIM_USER_AGENT || 'OpenTripBoard/1.0';
    this.timeout = 5000; // 5 second timeout
  }

  /**
   * Search for locations matching query
   * @param {string} query - Search query (e.g., "Paris")
   * @param {number} limit - Maximum results to return (default 5)
   * @param {string} language - Accept-Language header (default 'en')
   * @returns {Promise<Array>} - Array of location results
   */
  async search(query, limit = 5, language = 'en') {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: limit.toString(),
      addressdetails: '1',
      'accept-language': language,
    });

    const url = `${this.baseUrl}/search?${params.toString()}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': this.userAgent,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('RATE_LIMIT_EXCEEDED');
        }
        if (response.status === 503) {
          throw new Error('SERVICE_UNAVAILABLE');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('REQUEST_TIMEOUT');
      }
      throw error;
    }
  }
}

/**
 * HTTP client for Pexels API (image search)
 * Handles authentication and rate limiting
 */
export class PexelsClient {
  constructor() {
    this.baseUrl = 'https://api.pexels.com/v1';
    this.apiKey = process.env.PEXELS_API_KEY;
    this.timeout = 10000; // 10 second timeout

    if (!this.apiKey || this.apiKey === 'your_pexels_api_key_here') {
      console.warn(
        'PEXELS_API_KEY not configured. Cover image fetching will fail.'
      );
    }
  }

  /**
   * Search for photos matching query
   * @param {string} query - Search query (e.g., "Paris France landmark")
   * @param {Object} options - Search options
   * @param {number} options.perPage - Results per page (default 10)
   * @param {string} options.orientation - Image orientation (default 'landscape')
   * @param {string} options.size - Image size (default 'medium')
   * @returns {Promise<Object>} - Pexels API response with photos array
   */
  async search(query, options = {}) {
    const {
      perPage = 10,
      orientation = 'landscape',
      size = 'medium',
    } = options;

    if (!this.apiKey || this.apiKey === 'your_pexels_api_key_here') {
      throw new Error('PEXELS_API_KEY_NOT_CONFIGURED');
    }

    const params = new URLSearchParams({
      query,
      per_page: perPage.toString(),
      orientation,
      size,
    });

    const url = `${this.baseUrl}/search?${params.toString()}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: this.apiKey,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('RATE_LIMIT_EXCEEDED');
        }
        if (response.status === 401) {
          throw new Error('INVALID_API_KEY');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('REQUEST_TIMEOUT');
      }
      throw error;
    }
  }

  /**
   * Download image from URL
   * @param {string} imageUrl - URL of image to download
   * @returns {Promise<Buffer>} - Image data as Buffer
   */
  async downloadImage(imageUrl) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(imageUrl, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('IMAGE_DOWNLOAD_TIMEOUT');
      }
      throw error;
    }
  }
}

/**
 * Factory function to create Nominatim client instance
 * @returns {NominatimClient}
 */
export function createNominatimClient() {
  return new NominatimClient();
}

/**
 * Factory function to create Pexels client instance
 * @returns {PexelsClient}
 */
export function createPexelsClient() {
  return new PexelsClient();
}
