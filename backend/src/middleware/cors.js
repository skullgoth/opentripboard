/**
 * CORS Middleware Configuration
 * T033: Implements Cross-Origin Resource Sharing for API security
 */

/**
 * CORS middleware factory
 * @param {Object} options - CORS configuration options
 * @param {string|string[]} options.origin - Allowed origins
 * @param {string[]} options.methods - Allowed HTTP methods
 * @param {string[]} options.allowedHeaders - Allowed request headers
 * @param {boolean} options.credentials - Allow credentials
 * @returns {Function} Express middleware function
 */
function corsMiddleware(options = {}) {
  const {
    origin = process.env.CORS_ORIGIN || '*',
    methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders = ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials = true,
  } = options;

  return (req, res, next) => {
    // Handle origin
    if (typeof origin === 'string') {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (Array.isArray(origin)) {
      const requestOrigin = req.headers.origin;
      if (origin.includes(requestOrigin)) {
        res.setHeader('Access-Control-Allow-Origin', requestOrigin);
      }
    }

    // Set other CORS headers
    res.setHeader('Access-Control-Allow-Methods', methods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', allowedHeaders.join(', '));

    if (credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  };
}

module.exports = { corsMiddleware };
