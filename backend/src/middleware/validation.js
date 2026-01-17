// T033: Input validation middleware with JSON schema validation
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true, removeAdditional: 'all' });
addFormats(ajv);

/**
 * Create validation middleware for request body
 * @param {Object} schema - JSON schema for validation
 * @returns {Function} Fastify middleware function
 */
export function validateBody(schema) {
  const validate = ajv.compile(schema);

  return async function (request, reply) {
    const valid = validate(request.body);

    if (!valid) {
      const errors = validate.errors.map((err) => ({
        field: err.instancePath.replace('/', '') || err.params.missingProperty,
        message: err.message,
      }));

      return reply.code(400).send({
        error: 'Validation Error',
        message: 'Request body validation failed',
        errors,
      });
    }
  };
}

/**
 * Create validation middleware for query parameters
 * @param {Object} schema - JSON schema for validation
 * @returns {Function} Fastify middleware function
 */
export function validateQuery(schema) {
  const validate = ajv.compile(schema);

  return async function (request, reply) {
    const valid = validate(request.query);

    if (!valid) {
      const errors = validate.errors.map((err) => ({
        field: err.instancePath.replace('/', '') || err.params.missingProperty,
        message: err.message,
      }));

      return reply.code(400).send({
        error: 'Validation Error',
        message: 'Query parameters validation failed',
        errors,
      });
    }
  };
}

/**
 * Create validation middleware for route parameters
 * @param {Object} schema - JSON schema for validation
 * @returns {Function} Fastify middleware function
 */
export function validateParams(schema) {
  const validate = ajv.compile(schema);

  return async function (request, reply) {
    const valid = validate(request.params);

    if (!valid) {
      const errors = validate.errors.map((err) => ({
        field: err.instancePath.replace('/', '') || err.params.missingProperty,
        message: err.message,
      }));

      return reply.code(400).send({
        error: 'Validation Error',
        message: 'Route parameters validation failed',
        errors,
      });
    }
  };
}

// Common validation schemas
export const schemas = {
  uuid: {
    type: 'string',
    format: 'uuid',
  },

  email: {
    type: 'string',
    format: 'email',
    maxLength: 255,
  },

  password: {
    type: 'string',
    minLength: 8,
    maxLength: 128,
  },

  date: {
    type: 'string',
    format: 'date',
  },

  dateTime: {
    type: 'string',
    format: 'date-time',
  },

  positiveInteger: {
    type: 'integer',
    minimum: 1,
  },

  nonNegativeNumber: {
    type: 'number',
    minimum: 0,
  },
};
