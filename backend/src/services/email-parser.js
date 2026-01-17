// T193: Email parser service - parse confirmation emails for reservation details
import logger from '../utils/logger.js';

/**
 * Reservation types that can be parsed
 */
export const RESERVATION_TYPES = {
  FLIGHT: 'flight',
  HOTEL: 'accommodation',
  CAR: 'transportation',
  RESTAURANT: 'restaurant',
  EVENT: 'event',
  OTHER: 'other'
};

/**
 * Airline patterns for flight confirmation emails
 */
const AIRLINE_PATTERNS = [
  // Generic flight patterns
  {
    name: 'Generic Flight',
    confirmationPattern: /(?:confirmation|booking|reservation)\s*(?:number|code|#|:)\s*([A-Z0-9]{5,8})/i,
    flightPattern: /(?:flight|flt)\s*(?:#|number|:)?\s*([A-Z]{2}\d{3,4})/gi,
    datePattern: /(?:depart(?:ure|ing)?|date)\s*[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\w+\s+\d{1,2},?\s+\d{4})/i,
    timePattern: /(?:depart(?:ure|ing)?|time)\s*[:\s]*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i,
    fromPattern: /(?:from|origin|departing)\s*[:\s]*([A-Z]{3}|[A-Za-z\s,]+(?:Airport)?)/i,
    toPattern: /(?:to|destination|arriving)\s*[:\s]*([A-Z]{3}|[A-Za-z\s,]+(?:Airport)?)/i,
  },
  // United Airlines
  {
    name: 'United Airlines',
    provider: 'United Airlines',
    identifierPattern: /united\.com|united\s+airlines/i,
    confirmationPattern: /confirmation\s*(?:number|#)?\s*:?\s*([A-Z0-9]{6})/i,
  },
  // Delta
  {
    name: 'Delta Air Lines',
    provider: 'Delta Air Lines',
    identifierPattern: /delta\.com|delta\s+air/i,
    confirmationPattern: /confirmation\s*(?:number|code)?\s*:?\s*([A-Z0-9]{6})/i,
  },
  // American Airlines
  {
    name: 'American Airlines',
    provider: 'American Airlines',
    identifierPattern: /aa\.com|american\s+airlines/i,
    confirmationPattern: /(?:record\s+locator|confirmation)\s*:?\s*([A-Z0-9]{6})/i,
  },
  // Southwest
  {
    name: 'Southwest Airlines',
    provider: 'Southwest Airlines',
    identifierPattern: /southwest\.com|southwest\s+airlines/i,
    confirmationPattern: /confirmation\s*#?\s*:?\s*([A-Z0-9]{6})/i,
  },
];

/**
 * Hotel patterns for accommodation confirmation emails
 */
const HOTEL_PATTERNS = [
  // Generic hotel patterns
  {
    name: 'Generic Hotel',
    confirmationPattern: /(?:confirmation|booking|reservation)\s*(?:number|code|#|:)\s*([A-Z0-9]{6,15})/i,
    hotelNamePattern: /(?:hotel|property|stay(?:ing)?(?:\s+at)?)\s*[:\s]*([A-Za-z0-9\s&'.-]+(?:Hotel|Inn|Resort|Suites|Lodge)?)/i,
    checkInPattern: /(?:check[\s-]?in|arrival)\s*[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\w+\s+\d{1,2},?\s+\d{4})/i,
    checkOutPattern: /(?:check[\s-]?out|departure)\s*[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\w+\s+\d{1,2},?\s+\d{4})/i,
    addressPattern: /(?:address|location)\s*[:\s]*([A-Za-z0-9\s,.-]+(?:\d{5})?)/i,
  },
  // Marriott
  {
    name: 'Marriott',
    provider: 'Marriott',
    identifierPattern: /marriott\.com|marriott\s+bonvoy/i,
    confirmationPattern: /confirmation\s*(?:number|#)?\s*:?\s*([A-Z0-9]{8,10})/i,
  },
  // Hilton
  {
    name: 'Hilton',
    provider: 'Hilton',
    identifierPattern: /hilton\.com|hilton\s+honors/i,
    confirmationPattern: /confirmation\s*(?:number|#)?\s*:?\s*([A-Z0-9]{8,12})/i,
  },
  // Booking.com
  {
    name: 'Booking.com',
    provider: 'Booking.com',
    identifierPattern: /booking\.com/i,
    confirmationPattern: /(?:confirmation|booking)\s*(?:number|#)?\s*:?\s*(\d{8,12})/i,
  },
  // Airbnb
  {
    name: 'Airbnb',
    provider: 'Airbnb',
    identifierPattern: /airbnb\.com|airbnb/i,
    confirmationPattern: /(?:confirmation|reservation)\s*(?:code|#)?\s*:?\s*([A-Z0-9]{10,12})/i,
  },
];

/**
 * Car rental patterns
 */
const CAR_RENTAL_PATTERNS = [
  // Generic car rental
  {
    name: 'Generic Car Rental',
    confirmationPattern: /(?:confirmation|booking|reservation)\s*(?:number|code|#|:)\s*([A-Z0-9]{6,15})/i,
    pickupPattern: /(?:pick[\s-]?up|rental\s+start)\s*[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\w+\s+\d{1,2},?\s+\d{4})/i,
    dropoffPattern: /(?:drop[\s-]?off|return|rental\s+end)\s*[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\w+\s+\d{1,2},?\s+\d{4})/i,
    locationPattern: /(?:pick[\s-]?up\s+location|location)\s*[:\s]*([A-Za-z0-9\s,.-]+)/i,
    vehiclePattern: /(?:vehicle|car)\s*(?:type|class)?\s*[:\s]*([A-Za-z0-9\s]+)/i,
  },
  // Hertz
  {
    name: 'Hertz',
    provider: 'Hertz',
    identifierPattern: /hertz\.com|hertz/i,
    confirmationPattern: /(?:confirmation|reservation)\s*(?:number|#)?\s*:?\s*([A-Z0-9]{8,12})/i,
  },
  // Enterprise
  {
    name: 'Enterprise',
    provider: 'Enterprise',
    identifierPattern: /enterprise\.com|enterprise\s+rent/i,
    confirmationPattern: /(?:confirmation|reservation)\s*(?:number|#)?\s*:?\s*([A-Z0-9]{7,10})/i,
  },
];

/**
 * Restaurant patterns
 */
const RESTAURANT_PATTERNS = [
  {
    name: 'Generic Restaurant',
    confirmationPattern: /(?:confirmation|booking|reservation)\s*(?:number|code|#|:)\s*([A-Z0-9]{4,12})/i,
    restaurantPattern: /(?:restaurant|dining|table)\s*(?:at|for)?\s*[:\s]*([A-Za-z0-9\s&'.-]+)/i,
    datePattern: /(?:date|reservation\s+for)\s*[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\w+\s+\d{1,2},?\s+\d{4})/i,
    timePattern: /(?:time|at)\s*[:\s]*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i,
    partySizePattern: /(?:party|guests|people)\s*(?:of|size)?\s*[:\s]*(\d{1,2})/i,
  },
  // OpenTable
  {
    name: 'OpenTable',
    provider: 'OpenTable',
    identifierPattern: /opentable\.com|opentable/i,
    confirmationPattern: /(?:confirmation|reservation)\s*(?:number|#)?\s*:?\s*([A-Z0-9]{6,10})/i,
  },
];

/**
 * Parse email content and extract reservation details
 * @param {string} emailContent - Raw email content (HTML or plain text)
 * @returns {Object} Parsed reservation data
 */
export function parseEmail(emailContent) {
  if (!emailContent || typeof emailContent !== 'string') {
    return {
      success: false,
      error: 'No email content provided',
      data: null
    };
  }

  // Strip HTML tags for easier pattern matching
  const plainText = stripHtml(emailContent);
  const lowerText = plainText.toLowerCase();

  logger.info('Parsing email content for reservation details');

  // Try to detect reservation type
  let type = detectReservationType(lowerText);
  let result = null;

  switch (type) {
    case RESERVATION_TYPES.FLIGHT:
      result = parseFlightEmail(plainText);
      break;
    case RESERVATION_TYPES.HOTEL:
      result = parseHotelEmail(plainText);
      break;
    case RESERVATION_TYPES.CAR:
      result = parseCarRentalEmail(plainText);
      break;
    case RESERVATION_TYPES.RESTAURANT:
      result = parseRestaurantEmail(plainText);
      break;
    default:
      // Try generic parsing
      result = parseGenericReservation(plainText);
      type = result?.type || RESERVATION_TYPES.OTHER;
  }

  if (result && result.confirmationCode) {
    logger.info(`Successfully parsed ${type} reservation: ${result.confirmationCode}`);
    return {
      success: true,
      data: {
        type,
        ...result
      }
    };
  }

  logger.warn('Could not parse reservation details from email');
  return {
    success: false,
    error: 'Could not extract reservation details from email content',
    data: null
  };
}

/**
 * Detect the type of reservation from email content
 * @param {string} text - Lowercase email text
 * @returns {string} Reservation type
 */
function detectReservationType(text) {
  // Flight indicators
  if (text.includes('flight') || text.includes('airline') || text.includes('boarding') ||
      text.includes('itinerary') && (text.includes('depart') || text.includes('arrive'))) {
    return RESERVATION_TYPES.FLIGHT;
  }

  // Hotel indicators
  if (text.includes('hotel') || text.includes('check-in') || text.includes('check in') ||
      text.includes('room') && text.includes('night') || text.includes('accommodation')) {
    return RESERVATION_TYPES.HOTEL;
  }

  // Car rental indicators
  if (text.includes('car rental') || text.includes('rent a car') || text.includes('vehicle') &&
      (text.includes('pick up') || text.includes('pickup') || text.includes('drop off'))) {
    return RESERVATION_TYPES.CAR;
  }

  // Restaurant indicators
  if (text.includes('restaurant') || text.includes('reservation') && text.includes('table') ||
      text.includes('dining') || text.includes('opentable')) {
    return RESERVATION_TYPES.RESTAURANT;
  }

  return RESERVATION_TYPES.OTHER;
}

/**
 * Parse flight confirmation email
 * @param {string} text - Email text
 * @returns {Object} Flight reservation data
 */
function parseFlightEmail(text) {
  let provider = null;
  let patterns = AIRLINE_PATTERNS[0]; // Default to generic

  // Try to identify specific airline
  for (const pattern of AIRLINE_PATTERNS.slice(1)) {
    if (pattern.identifierPattern && pattern.identifierPattern.test(text)) {
      provider = pattern.provider;
      patterns = { ...AIRLINE_PATTERNS[0], ...pattern };
      break;
    }
  }

  const confirmationCode = extractMatch(text, patterns.confirmationPattern);
  const flightNumbers = extractAllMatches(text, patterns.flightPattern);
  const departureDate = extractMatch(text, patterns.datePattern);
  const departureTime = extractMatch(text, patterns.timePattern);
  const origin = extractMatch(text, patterns.fromPattern);
  const destination = extractMatch(text, patterns.toPattern);

  return {
    confirmationCode,
    provider: provider || 'Unknown Airline',
    flightNumbers: flightNumbers.length > 0 ? flightNumbers : null,
    departureDate: parseDate(departureDate),
    departureTime,
    origin: cleanLocation(origin),
    destination: cleanLocation(destination),
    title: generateFlightTitle(origin, destination, flightNumbers),
    location: cleanLocation(origin)
  };
}

/**
 * Parse hotel confirmation email
 * @param {string} text - Email text
 * @returns {Object} Hotel reservation data
 */
function parseHotelEmail(text) {
  let provider = null;
  let patterns = HOTEL_PATTERNS[0]; // Default to generic

  // Try to identify specific hotel chain
  for (const pattern of HOTEL_PATTERNS.slice(1)) {
    if (pattern.identifierPattern && pattern.identifierPattern.test(text)) {
      provider = pattern.provider;
      patterns = { ...HOTEL_PATTERNS[0], ...pattern };
      break;
    }
  }

  const confirmationCode = extractMatch(text, patterns.confirmationPattern);
  const hotelName = extractMatch(text, patterns.hotelNamePattern);
  const checkInDate = extractMatch(text, patterns.checkInPattern);
  const checkOutDate = extractMatch(text, patterns.checkOutPattern);
  const address = extractMatch(text, patterns.addressPattern);

  return {
    confirmationCode,
    provider: provider || hotelName || 'Unknown Hotel',
    hotelName: cleanText(hotelName),
    checkInDate: parseDate(checkInDate),
    checkOutDate: parseDate(checkOutDate),
    address: cleanText(address),
    title: hotelName ? `Stay at ${cleanText(hotelName)}` : 'Hotel Reservation',
    location: cleanText(address) || cleanText(hotelName)
  };
}

/**
 * Parse car rental confirmation email
 * @param {string} text - Email text
 * @returns {Object} Car rental reservation data
 */
function parseCarRentalEmail(text) {
  let provider = null;
  let patterns = CAR_RENTAL_PATTERNS[0]; // Default to generic

  // Try to identify specific rental company
  for (const pattern of CAR_RENTAL_PATTERNS.slice(1)) {
    if (pattern.identifierPattern && pattern.identifierPattern.test(text)) {
      provider = pattern.provider;
      patterns = { ...CAR_RENTAL_PATTERNS[0], ...pattern };
      break;
    }
  }

  const confirmationCode = extractMatch(text, patterns.confirmationPattern);
  const pickupDate = extractMatch(text, patterns.pickupPattern);
  const dropoffDate = extractMatch(text, patterns.dropoffPattern);
  const location = extractMatch(text, patterns.locationPattern);
  const vehicleType = extractMatch(text, patterns.vehiclePattern);

  return {
    confirmationCode,
    provider: provider || 'Unknown Car Rental',
    pickupDate: parseDate(pickupDate),
    dropoffDate: parseDate(dropoffDate),
    pickupLocation: cleanText(location),
    vehicleType: cleanText(vehicleType),
    title: `Car Rental - ${provider || 'Rental'}`,
    location: cleanText(location)
  };
}

/**
 * Parse restaurant reservation email
 * @param {string} text - Email text
 * @returns {Object} Restaurant reservation data
 */
function parseRestaurantEmail(text) {
  let provider = null;
  let patterns = RESTAURANT_PATTERNS[0]; // Default to generic

  // Try to identify specific platform
  for (const pattern of RESTAURANT_PATTERNS.slice(1)) {
    if (pattern.identifierPattern && pattern.identifierPattern.test(text)) {
      provider = pattern.provider;
      patterns = { ...RESTAURANT_PATTERNS[0], ...pattern };
      break;
    }
  }

  const confirmationCode = extractMatch(text, patterns.confirmationPattern);
  const restaurantName = extractMatch(text, patterns.restaurantPattern);
  const reservationDate = extractMatch(text, patterns.datePattern);
  const reservationTime = extractMatch(text, patterns.timePattern);
  const partySize = extractMatch(text, patterns.partySizePattern);

  return {
    confirmationCode,
    provider: provider || 'Direct Booking',
    restaurantName: cleanText(restaurantName),
    reservationDate: parseDate(reservationDate),
    reservationTime,
    partySize: partySize ? parseInt(partySize, 10) : null,
    title: restaurantName ? `Dinner at ${cleanText(restaurantName)}` : 'Restaurant Reservation',
    location: cleanText(restaurantName)
  };
}

/**
 * Parse generic reservation when type is unknown
 * @param {string} text - Email text
 * @returns {Object} Generic reservation data
 */
function parseGenericReservation(text) {
  const confirmationPattern = /(?:confirmation|booking|reservation|reference)\s*(?:number|code|#|:)\s*([A-Z0-9]{4,15})/i;
  const datePattern = /(?:date|on)\s*[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\w+\s+\d{1,2},?\s+\d{4})/i;

  const confirmationCode = extractMatch(text, confirmationPattern);
  const date = extractMatch(text, datePattern);

  return {
    confirmationCode,
    provider: 'Unknown',
    date: parseDate(date),
    title: confirmationCode ? `Reservation ${confirmationCode}` : 'Reservation',
    type: RESERVATION_TYPES.OTHER
  };
}

/**
 * Strip HTML tags from text
 * @param {string} html - HTML content
 * @returns {string} Plain text
 */
function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract first match from text using pattern
 * @param {string} text - Text to search
 * @param {RegExp} pattern - Pattern to match
 * @returns {string|null} Matched text or null
 */
function extractMatch(text, pattern) {
  if (!pattern) return null;
  const match = text.match(pattern);
  return match ? match[1]?.trim() : null;
}

/**
 * Extract all matches from text using pattern
 * @param {string} text - Text to search
 * @param {RegExp} pattern - Pattern to match (must have global flag)
 * @returns {Array} Array of matched strings
 */
function extractAllMatches(text, pattern) {
  if (!pattern) return [];
  const matches = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    matches.push(match[1]?.trim());
  }
  return matches;
}

/**
 * Parse date string into ISO format
 * @param {string} dateStr - Date string
 * @returns {string|null} ISO date string or null
 */
function parseDate(dateStr) {
  if (!dateStr) return null;

  try {
    // Try various date formats
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }

    // Try MM/DD/YYYY format
    const parts = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (parts) {
      let year = parseInt(parts[3], 10);
      if (year < 100) year += 2000;
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const parsedDate = new Date(year, month, day);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString().split('T')[0];
      }
    }
  } catch (e) {
    logger.warn(`Failed to parse date: ${dateStr}`);
  }

  return null;
}

/**
 * Clean and normalize text
 * @param {string} text - Text to clean
 * @returns {string} Cleaned text
 */
function cleanText(text) {
  if (!text) return null;
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Clean location string
 * @param {string} location - Location text
 * @returns {string} Cleaned location
 */
function cleanLocation(location) {
  if (!location) return null;
  return location
    .replace(/\s+/g, ' ')
    .replace(/,\s*$/, '')
    .trim();
}

/**
 * Generate flight title
 * @param {string} origin - Origin location
 * @param {string} destination - Destination location
 * @param {Array} flightNumbers - Flight numbers
 * @returns {string} Flight title
 */
function generateFlightTitle(origin, destination, flightNumbers) {
  const parts = [];

  if (origin && destination) {
    parts.push(`Flight: ${cleanLocation(origin)} → ${cleanLocation(destination)}`);
  } else if (flightNumbers && flightNumbers.length > 0) {
    parts.push(`Flight ${flightNumbers[0]}`);
  } else {
    parts.push('Flight Reservation');
  }

  return parts.join(' ');
}

export default {
  parseEmail,
  RESERVATION_TYPES
};
