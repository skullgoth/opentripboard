// T289: HTTP caching headers middleware
import crypto from 'crypto';
import fp from 'fastify-plugin';

/**
 * Cache control configurations for different resource types
 */
export const cacheConfig = {
  // Static assets (images, CSS, JS) - cache for 1 year
  static: {
    maxAge: 31536000, // 1 year in seconds
    immutable: true,
  },

  // User-specific data - no caching
  private: {
    maxAge: 0,
    mustRevalidate: true,
    private: true,
  },

  // Shared data that changes rarely - cache for 5 minutes
  shared: {
    maxAge: 300, // 5 minutes
    staleWhileRevalidate: 60,
  },

  // API responses - short cache with revalidation
  api: {
    maxAge: 60, // 1 minute
    staleWhileRevalidate: 30,
    private: true,
  },

  // No caching for sensitive routes
  noCache: {
    noStore: true,
    noCache: true,
    mustRevalidate: true,
  },
};

/**
 * Build Cache-Control header value from config
 * @param {Object} config - Cache configuration
 * @returns {string} Cache-Control header value
 */
function buildCacheControl(config) {
  const directives = [];

  if (config.noStore) {
    directives.push('no-store');
  }
  if (config.noCache) {
    directives.push('no-cache');
  }
  if (config.private) {
    directives.push('private');
  } else if (!config.noStore && !config.noCache) {
    directives.push('public');
  }
  if (config.maxAge !== undefined) {
    directives.push(`max-age=${config.maxAge}`);
  }
  if (config.staleWhileRevalidate) {
    directives.push(`stale-while-revalidate=${config.staleWhileRevalidate}`);
  }
  if (config.mustRevalidate) {
    directives.push('must-revalidate');
  }
  if (config.immutable) {
    directives.push('immutable');
  }

  return directives.join(', ');
}

/**
 * Generate ETag from response body
 * @param {string|Buffer|Object} body - Response body
 * @returns {string} ETag value
 */
export function generateETag(body) {
  const content = typeof body === 'object' ? JSON.stringify(body) : String(body);
  const hash = crypto.createHash('md5').update(content).digest('hex');
  return `"${hash}"`;
}

/**
 * Add cache headers to response
 * @param {Object} reply - Fastify reply object
 * @param {Object} config - Cache configuration
 * @param {string} [etag] - Optional ETag value
 */
export function setCacheHeaders(reply, config, etag) {
  reply.header('Cache-Control', buildCacheControl(config));

  if (etag) {
    reply.header('ETag', etag);
  }

  // Add Vary header for proper caching
  reply.header('Vary', 'Accept, Authorization');
}

/**
 * Check if resource has been modified (ETag comparison)
 * @param {Object} request - Fastify request object
 * @param {string} etag - Current ETag value
 * @returns {boolean} True if not modified
 */
export function checkNotModified(request, etag) {
  const ifNoneMatch = request.headers['if-none-match'];
  return ifNoneMatch && ifNoneMatch === etag;
}

/**
 * Fastify plugin for cache headers
 * @param {FastifyInstance} fastify - Fastify instance
 */
async function cachePluginImpl(fastify) {
  // Decorate reply with cache helper methods
  fastify.decorateReply('setCacheHeaders', function (config, etag) {
    setCacheHeaders(this, config, etag);
    return this;
  });

  fastify.decorateReply('setNoCache', function () {
    setCacheHeaders(this, cacheConfig.noCache);
    return this;
  });

  fastify.decorateReply('setPrivateCache', function () {
    setCacheHeaders(this, cacheConfig.private);
    return this;
  });

  fastify.decorateReply('setApiCache', function (etag) {
    setCacheHeaders(this, cacheConfig.api, etag);
    return this;
  });

  fastify.decorateReply('setSharedCache', function (etag) {
    setCacheHeaders(this, cacheConfig.shared, etag);
    return this;
  });

  // Add hook to set default cache headers for API routes
  fastify.addHook('onSend', async (request, reply, payload) => {
    // Skip if cache headers already set
    if (reply.getHeader('Cache-Control')) {
      return payload;
    }

    // Set default no-cache for API routes
    if (request.url.startsWith('/api/')) {
      setCacheHeaders(reply, cacheConfig.private);
    }

    return payload;
  });
}

export const cachePlugin = fp(cachePluginImpl, {
  name: 'cache-headers',
});

export default cachePlugin;
