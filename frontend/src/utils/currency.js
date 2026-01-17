// T223: Currency formatting utility

/**
 * Currency symbols mapping
 */
const CURRENCY_SYMBOLS = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  KRW: '₩',
  INR: '₹',
  RUB: '₽',
  BRL: 'R$',
  CAD: 'C$',
  AUD: 'A$',
  CHF: 'CHF',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  PLN: 'zł',
  THB: '฿',
  SGD: 'S$',
  HKD: 'HK$',
  MXN: 'MX$',
  NZD: 'NZ$',
  ZAR: 'R',
  TRY: '₺',
  AED: 'د.إ',
  SAR: '﷼',
  MYR: 'RM',
  PHP: '₱',
  IDR: 'Rp',
  VND: '₫',
  CZK: 'Kč',
  HUF: 'Ft',
  ILS: '₪',
  CLP: 'CLP$',
  COP: 'COL$',
  PEN: 'S/',
  ARS: 'ARS$',
  TWD: 'NT$',
};

/**
 * Get currency symbol for a currency code
 * @param {string} currencyCode - ISO 4217 currency code
 * @returns {string} Currency symbol or code if not found
 */
export function getCurrencySymbol(currencyCode) {
  return CURRENCY_SYMBOLS[currencyCode?.toUpperCase()] || currencyCode || '$';
}

/**
 * Format a number as currency
 * @param {number} amount - Amount to format
 * @param {string} currencyCode - ISO 4217 currency code
 * @param {Object} options - Formatting options
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount, currencyCode = 'USD', options = {}) {
  const {
    locale = 'en-US',
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    useSymbol = true,
    showSign = false,
  } = options;

  // Handle null/undefined
  if (amount === null || amount === undefined) {
    return useSymbol ? `${getCurrencySymbol(currencyCode)}0.00` : '0.00';
  }

  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  // Try using Intl.NumberFormat for proper locale formatting
  try {
    const formatted = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode || 'USD',
      minimumFractionDigits,
      maximumFractionDigits,
      signDisplay: showSign ? 'exceptZero' : 'auto',
    }).format(numAmount);

    return formatted;
  } catch {
    // Fallback for unsupported currencies
    const sign = showSign && numAmount > 0 ? '+' : '';
    const symbol = useSymbol ? getCurrencySymbol(currencyCode) : '';
    const formattedNumber = Math.abs(numAmount).toFixed(minimumFractionDigits);

    if (numAmount < 0) {
      return `-${symbol}${formattedNumber}`;
    }
    return `${sign}${symbol}${formattedNumber}`;
  }
}

/**
 * Format a compact currency value (e.g., $1.2K, $3.5M)
 * @param {number} amount - Amount to format
 * @param {string} currencyCode - ISO 4217 currency code
 * @returns {string} Compact formatted currency string
 */
export function formatCompactCurrency(amount, currencyCode = 'USD') {
  if (amount === null || amount === undefined) {
    return `${getCurrencySymbol(currencyCode)}0`;
  }

  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  const symbol = getCurrencySymbol(currencyCode);

  const absAmount = Math.abs(numAmount);
  const sign = numAmount < 0 ? '-' : '';

  if (absAmount >= 1000000) {
    return `${sign}${symbol}${(absAmount / 1000000).toFixed(1)}M`;
  }
  if (absAmount >= 1000) {
    return `${sign}${symbol}${(absAmount / 1000).toFixed(1)}K`;
  }
  return `${sign}${symbol}${absAmount.toFixed(2)}`;
}

/**
 * Parse a currency string to a number
 * @param {string} currencyString - Currency string to parse
 * @returns {number} Parsed number
 */
export function parseCurrency(currencyString) {
  if (typeof currencyString === 'number') {
    return currencyString;
  }

  if (!currencyString) {
    return 0;
  }

  // Remove currency symbols and thousands separators
  const cleaned = currencyString
    .replace(/[^0-9.-]/g, '')
    .replace(/,/g, '');

  return parseFloat(cleaned) || 0;
}

/**
 * Get common currencies for selection
 * @returns {Array} Array of currency objects { code, name, symbol }
 */
export function getCommonCurrencies() {
  return [
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
    { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
    { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
    { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
    { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
    { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$' },
    { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
    { code: 'THB', name: 'Thai Baht', symbol: '฿' },
    { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
    { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  ];
}

/**
 * Format a percentage
 * @param {number} percentage - Percentage value (0-100)
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted percentage string
 */
export function formatPercentage(percentage, decimals = 0) {
  if (percentage === null || percentage === undefined) {
    return '0%';
  }

  return `${percentage.toFixed(decimals)}%`;
}

/**
 * Calculate percentage
 * @param {number} value - Current value
 * @param {number} total - Total value
 * @returns {number} Percentage (0-100)
 */
export function calculatePercentage(value, total) {
  if (!total || total === 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, (value / total) * 100));
}
