/**
 * Input Validation Utilities
 * T048: Client-side validation helpers for forms and user input
 */

/**
 * Email validation
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid email format
 */
export function isValidEmail(email) {
  if (typeof email !== 'string') {
    return false;
  }
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  return emailRegex.test(email.trim());
}

/**
 * Password strength validation
 * @param {string} password - Password to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validatePassword(password) {
  const errors = [];

  if (typeof password !== 'string') {
    return { valid: false, errors: ['Password must be a string'] };
  }

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate a random password that meets complexity requirements
 * @param {number} length - Password length (minimum 12, default 16)
 * @returns {string} Generated password
 */
export function generatePassword(length = 16) {
  const minLength = 12;
  const actualLength = Math.max(length, minLength);

  const lowercase = 'abcdefghijkmnopqrstuvwxyz'; // Removed l to avoid confusion with 1
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Removed I and O to avoid confusion
  const numbers = '23456789'; // Removed 0 and 1 to avoid confusion
  const allChars = lowercase + uppercase + numbers;

  // Ensure at least one of each required type
  let password = '';
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];

  // Fill the rest with random characters
  for (let i = password.length; i < actualLength; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password to randomize position of required characters
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

/**
 * Required field validation
 * @param {*} value - Value to validate
 * @returns {boolean} True if value is present
 */
export function isRequired(value) {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return true;
}

/**
 * String length validation
 * @param {string} value - String to validate
 * @param {number} min - Minimum length
 * @param {number} max - Maximum length
 * @returns {boolean} True if length is within range
 */
export function isValidLength(value, min = 0, max = Infinity) {
  if (typeof value !== 'string') {
    return false;
  }
  const length = value.trim().length;
  return length >= min && length <= max;
}

/**
 * Date validation
 * @param {string|Date} date - Date to validate
 * @returns {boolean} True if valid date
 */
export function isValidDate(date) {
  const dateObj = date instanceof Date ? date : new Date(date);
  return !isNaN(dateObj.getTime());
}

/**
 * Date range validation
 * @param {string|Date} startDate - Start date
 * @param {string|Date} endDate - End date
 * @returns {boolean} True if end date is after or equal to start date
 */
export function isValidDateRange(startDate, endDate) {
  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return false;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  return end >= start;
}

/**
 * Number validation
 * @param {*} value - Value to validate
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {boolean} True if valid number within range
 */
export function isValidNumber(value, min = -Infinity, max = Infinity) {
  const num = Number(value);
  return !isNaN(num) && num >= min && num <= max;
}

/**
 * Currency amount validation
 * @param {*} value - Value to validate
 * @returns {boolean} True if valid currency amount (non-negative, max 2 decimals)
 */
export function isValidCurrency(value) {
  const num = Number(value);
  if (isNaN(num) || num < 0) {
    return false;
  }

  // Check for max 2 decimal places
  const decimalPart = String(value).split('.')[1];
  return !decimalPart || decimalPart.length <= 2;
}

/**
 * URL validation
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid URL
 */
export function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Coordinate validation
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {boolean} True if valid coordinates
 */
export function isValidCoordinates(lat, lng) {
  return (
    isValidNumber(lat, -90, 90) &&
    isValidNumber(lng, -180, 180)
  );
}

/**
 * Form validation helper
 * @param {Object} data - Form data object
 * @param {Object} rules - Validation rules object
 * @returns {Object} { valid: boolean, errors: Object }
 */
export function validateForm(data, rules) {
  const errors = {};

  Object.entries(rules).forEach(([field, validators]) => {
    const value = data[field];
    const fieldErrors = [];

    validators.forEach((validator) => {
      const result = validator.fn(value, validator.args);
      if (!result) {
        fieldErrors.push(validator.message);
      }
    });

    if (fieldErrors.length > 0) {
      errors[field] = fieldErrors;
    }
  });

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Cover image file validation
 * @param {File} file - Image file to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateCoverImage(file) {
  const errors = [];

  if (!file || !(file instanceof File)) {
    return { valid: false, errors: ['No file provided'] };
  }

  // Check file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    errors.push('Image must be JPEG, PNG, or WebP format');
  }

  // Check file size (5MB max)
  const maxSize = 5 * 1024 * 1024; // 5MB in bytes
  if (file.size > maxSize) {
    errors.push('Image size must be less than 5MB');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate image dimensions
 * @param {HTMLImageElement} img - Image element to validate
 * @param {Object} options - Validation options
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateImageDimensions(img, options = {}) {
  const {
    minWidth = 800,
    minHeight = 400,
    maxWidth = 5000,
    maxHeight = 5000,
  } = options;

  const errors = [];

  if (img.width < minWidth || img.height < minHeight) {
    errors.push(`Image must be at least ${minWidth}x${minHeight} pixels`);
  }

  if (img.width > maxWidth || img.height > maxHeight) {
    errors.push(`Image must not exceed ${maxWidth}x${maxHeight} pixels`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get file extension from filename
 * @param {string} filename - File name
 * @returns {string} File extension (lowercase, without dot)
 */
export function getFileExtension(filename) {
  if (typeof filename !== 'string') {
    return '';
  }
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size (e.g., "2.5 MB")
 */
export function formatFileSize(bytes) {
  if (typeof bytes !== 'number' || bytes < 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
