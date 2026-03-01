/**
 * Centralized upload size configuration
 * Driven by MAX_UPLOAD_SIZE_MB environment variable (default: 10)
 */

const MAX_UPLOAD_SIZE_MB = parseInt(process.env.MAX_UPLOAD_SIZE_MB, 10) || 10;
const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

export { MAX_UPLOAD_SIZE_MB, MAX_UPLOAD_SIZE_BYTES };
