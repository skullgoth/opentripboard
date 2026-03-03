// Weather forecast widget for trip detail page
import { t } from '../utils/i18n.js';

/**
 * WMO Weather Code to emoji + i18n key mapping
 * See: https://www.nodc.noaa.gov/archive/arc0021/0002199/1.1/data/0-data/HTML/WMO-CODE/WMO4677.HTM
 */
const weatherCodeMap = {
  0: { emoji: '\u2600\uFE0F', key: 'clearSky' },
  1: { emoji: '\u{1F324}\uFE0F', key: 'mainlyClear' },
  2: { emoji: '\u26C5', key: 'partlyCloudy' },
  3: { emoji: '\u2601\uFE0F', key: 'overcast' },
  45: { emoji: '\u{1F32B}\uFE0F', key: 'fog' },
  48: { emoji: '\u{1F32B}\uFE0F', key: 'fog' },
  51: { emoji: '\u{1F326}\uFE0F', key: 'drizzle' },
  53: { emoji: '\u{1F326}\uFE0F', key: 'drizzle' },
  55: { emoji: '\u{1F326}\uFE0F', key: 'drizzle' },
  56: { emoji: '\u{1F327}\uFE0F', key: 'freezingDrizzle' },
  57: { emoji: '\u{1F327}\uFE0F', key: 'freezingDrizzle' },
  61: { emoji: '\u{1F327}\uFE0F', key: 'rain' },
  63: { emoji: '\u{1F327}\uFE0F', key: 'rain' },
  65: { emoji: '\u{1F327}\uFE0F', key: 'heavyRain' },
  66: { emoji: '\u{1F327}\uFE0F', key: 'freezingRain' },
  67: { emoji: '\u{1F327}\uFE0F', key: 'freezingRain' },
  71: { emoji: '\u{1F328}\uFE0F', key: 'snow' },
  73: { emoji: '\u{1F328}\uFE0F', key: 'snow' },
  75: { emoji: '\u{1F328}\uFE0F', key: 'heavySnow' },
  77: { emoji: '\u{1F328}\uFE0F', key: 'snowGrains' },
  80: { emoji: '\u{1F326}\uFE0F', key: 'showers' },
  81: { emoji: '\u{1F326}\uFE0F', key: 'showers' },
  82: { emoji: '\u{1F327}\uFE0F', key: 'heavyShowers' },
  85: { emoji: '\u{1F328}\uFE0F', key: 'snowShowers' },
  86: { emoji: '\u{1F328}\uFE0F', key: 'heavySnowShowers' },
  95: { emoji: '\u26C8\uFE0F', key: 'thunderstorm' },
  96: { emoji: '\u26C8\uFE0F', key: 'thunderstormHail' },
  99: { emoji: '\u26C8\uFE0F', key: 'thunderstormHail' },
};

/**
 * Get weather info for a WMO code
 * @param {number} code - WMO weather code
 * @returns {{ emoji: string, description: string }}
 */
function getWeatherInfo(code) {
  const info = weatherCodeMap[code] || { emoji: '\u2753', key: 'unknown' };
  return {
    emoji: info.emoji,
    description: t(`weather.conditions.${info.key}`),
  };
}

/**
 * Format day name from date string
 * @param {string} dateStr - Date string (YYYY-MM-DD)
 * @returns {string} Short day name (Mon, Tue, etc.)
 */
function formatDayName(dateStr) {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString(undefined, { weekday: 'short' });
}

/**
 * Format date as short month/day
 * @param {string} dateStr - Date string (YYYY-MM-DD)
 * @returns {string} Short date (e.g., "Jan 5")
 */
function formatShortDate(dateStr) {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Create weather widget HTML
 * @param {Array} days - Array of { date, tempMax, tempMin, weatherCode, precipitation, source }
 * @param {string} source - Data source: 'forecast', 'climate', or 'mixed'
 * @returns {string} HTML string
 */
export function createWeatherWidget(days, source) {
  if (!days || days.length === 0) {
    return '';
  }

  const isClimate = source === 'climate';
  const isMixed = source === 'mixed';
  const title = isClimate ? t('weather.titleClimate') : t('weather.title');
  const subtitle = isClimate || isMixed
    ? `<span class="weather-widget-subtitle">${t('weather.climateHint')}</span>`
    : '';

  const dayCards = days
    .map((day) => {
      const weather = getWeatherInfo(day.weatherCode);
      const tempMax = day.tempMax != null ? `${Math.round(day.tempMax)}\u00B0` : '--';
      const tempMin = day.tempMin != null ? `${Math.round(day.tempMin)}\u00B0` : '--';
      const isClimateDay = day.source === 'climate';
      const cardClass = `weather-day-card${isClimateDay ? ' weather-day-climate' : ''}`;
      const tooltip = isClimateDay
        ? `${weather.description} (${t('weather.typical')})`
        : weather.description;

      return `
        <div class="${cardClass}" title="${tooltip}">
          <span class="weather-day-name">${formatDayName(day.date)}</span>
          <span class="weather-day-date">${formatShortDate(day.date)}</span>
          <span class="weather-day-icon">${weather.emoji}</span>
          <span class="weather-day-temp-max">${tempMax}</span>
          <span class="weather-day-temp-min">${tempMin}</span>
        </div>
      `;
    })
    .join('');

  return `
    <div class="weather-widget" data-testid="weather-widget">
      <div class="weather-widget-header">
        <span class="weather-widget-title">${title}</span>
        ${subtitle}
      </div>
      <div class="weather-widget-scroll">
        ${dayCards}
      </div>
    </div>
  `;
}

/**
 * Create loading skeleton for weather widget
 * @returns {string} HTML string
 */
export function createWeatherLoading() {
  const skeletonCards = Array.from({ length: 7 })
    .map(
      () => `
      <div class="weather-day-card weather-skeleton-card">
        <span class="weather-skeleton-line weather-skeleton-short"></span>
        <span class="weather-skeleton-line weather-skeleton-short"></span>
        <span class="weather-skeleton-line weather-skeleton-icon"></span>
        <span class="weather-skeleton-line weather-skeleton-short"></span>
        <span class="weather-skeleton-line weather-skeleton-short"></span>
      </div>
    `
    )
    .join('');

  return `
    <div class="weather-widget weather-widget-loading" data-testid="weather-loading">
      <div class="weather-widget-header">
        <span class="weather-skeleton-line weather-skeleton-title"></span>
      </div>
      <div class="weather-widget-scroll">
        ${skeletonCards}
      </div>
    </div>
  `;
}

/**
 * Create error state for weather widget
 * @returns {string} HTML string
 */
export function createWeatherError() {
  return `
    <div class="weather-widget weather-widget-error" data-testid="weather-error">
      <span class="weather-error-text">${t('weather.unavailable')}</span>
    </div>
  `;
}
