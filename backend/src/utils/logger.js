/**
 * Logger Utility
 * T034: Structured JSON logging for application monitoring
 */

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'info'];

/**
 * Format log entry as JSON
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} metadata - Additional context
 * @returns {string} JSON formatted log entry
 */
function formatLog(level, message, metadata = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...metadata,
  };

  // Add error stack if present
  if (metadata.error instanceof Error) {
    entry.error = {
      message: metadata.error.message,
      stack: metadata.error.stack,
      name: metadata.error.name,
    };
  }

  return JSON.stringify(entry);
}

/**
 * Logger interface
 */
const logger = {
  /**
   * Debug level logging
   * @param {string} message - Log message
   * @param {Object} metadata - Additional context
   */
  debug(message, metadata = {}) {
    if (currentLevel <= LOG_LEVELS.debug) {
      console.log(formatLog('debug', message, metadata));
    }
  },

  /**
   * Info level logging
   * @param {string} message - Log message
   * @param {Object} metadata - Additional context
   */
  info(message, metadata = {}) {
    if (currentLevel <= LOG_LEVELS.info) {
      console.log(formatLog('info', message, metadata));
    }
  },

  /**
   * Warning level logging
   * @param {string} message - Log message
   * @param {Object} metadata - Additional context
   */
  warn(message, metadata = {}) {
    if (currentLevel <= LOG_LEVELS.warn) {
      console.warn(formatLog('warn', message, metadata));
    }
  },

  /**
   * Error level logging
   * @param {string} message - Log message
   * @param {Object} metadata - Additional context
   */
  error(message, metadata = {}) {
    if (currentLevel <= LOG_LEVELS.error) {
      console.error(formatLog('error', message, metadata));
    }
  },

  /**
   * Create child logger with context
   * @param {Object} context - Default context for all logs
   * @returns {Object} Child logger instance
   */
  child(context = {}) {
    return {
      debug: (message, metadata = {}) => logger.debug(message, { ...context, ...metadata }),
      info: (message, metadata = {}) => logger.info(message, { ...context, ...metadata }),
      warn: (message, metadata = {}) => logger.warn(message, { ...context, ...metadata }),
      error: (message, metadata = {}) => logger.error(message, { ...context, ...metadata }),
    };
  },
};

export default logger;
