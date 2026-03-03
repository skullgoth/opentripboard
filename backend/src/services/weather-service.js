// Weather forecast service with Open-Meteo API and LRU cache
import { LRUCache } from 'lru-cache';
import { createOpenMeteoClient } from '../utils/api-client.js';

/**
 * Weather service for trip destination forecasts
 * Uses Open-Meteo API with in-memory LRU cache (6-hour TTL)
 *
 * Data sources by date range:
 * - Past dates → Archive API (actual historical weather)
 * - Next 16 days → Forecast API (precise forecast)
 * - Beyond 16 days → Climate API (climate model projections, marked as "climate")
 */
export class WeatherService {
  constructor() {
    this.client = createOpenMeteoClient();

    // LRU cache: 500 entries, 6-hour TTL
    this.cache = new LRUCache({
      max: 500,
      ttl: 1000 * 60 * 60 * 6, // 6 hours
      updateAgeOnGet: false,
      updateAgeOnHas: false,
    });
  }

  /**
   * Get weather forecast for a location and date range
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Object>} - Forecast data with caching metadata
   */
  async getForecast(lat, lon, startDate, endDate) {
    // Round coordinates to 2 decimal places for cache key
    const roundedLat = Math.round(lat * 100) / 100;
    const roundedLon = Math.round(lon * 100) / 100;

    const cacheKey = `${roundedLat}:${roundedLon}:${startDate}:${endDate}`;

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Determine which API(s) to use based on dates
    const maxForecastDate = new Date(today);
    maxForecastDate.setDate(maxForecastDate.getDate() + 15); // 16-day window (0-indexed)

    let days = [];
    let source = 'forecast'; // Track data source: 'forecast', 'archive', 'climate', 'mixed'

    // Past dates: use archive API
    if (end < today) {
      source = 'archive';
      const archiveData = await this.client.getDailyArchive(
        roundedLat,
        roundedLon,
        startDate,
        endDate,
        'auto'
      );
      days = this._transformResponse(archiveData);
    }
    // Future dates
    else if (start >= today) {
      // Entirely beyond forecast window → use climate API
      if (start > maxForecastDate) {
        source = 'climate';
        const climateData = await this.client.getDailyClimate(
          roundedLat,
          roundedLon,
          startDate,
          endDate
        );
        days = this._transformClimateResponse(climateData);
      }
      // Partially within forecast window → forecast + climate
      else if (end > maxForecastDate) {
        source = 'mixed';
        const clampedEnd = this._formatDate(maxForecastDate);
        const climateStart = this._formatDate(
          new Date(maxForecastDate.getTime() + 86400000)
        );

        const [forecastData, climateData] = await Promise.all([
          this.client.getDailyForecast(
            roundedLat, roundedLon, startDate, clampedEnd, 'auto'
          ),
          this.client.getDailyClimate(
            roundedLat, roundedLon, climateStart, endDate
          ),
        ]);

        days = [
          ...this._transformResponse(forecastData),
          ...this._transformClimateResponse(climateData),
        ];
      }
      // Fully within forecast window
      else {
        const forecastData = await this.client.getDailyForecast(
          roundedLat,
          roundedLon,
          startDate,
          endDate,
          'auto'
        );
        days = this._transformResponse(forecastData);
      }
    }
    // Mixed: past + future
    else {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const todayStr = this._formatDate(today);
      const yesterdayStr = this._formatDate(yesterday);

      const fetches = [
        this.client.getDailyArchive(
          roundedLat, roundedLon, startDate, yesterdayStr, 'auto'
        ),
      ];

      // Future portion: forecast + possibly climate
      if (end > maxForecastDate) {
        source = 'mixed';
        const clampedEnd = this._formatDate(maxForecastDate);
        const climateStart = this._formatDate(
          new Date(maxForecastDate.getTime() + 86400000)
        );

        fetches.push(
          this.client.getDailyForecast(
            roundedLat, roundedLon, todayStr, clampedEnd, 'auto'
          ),
          this.client.getDailyClimate(
            roundedLat, roundedLon, climateStart, endDate
          ),
        );

        const [archiveData, forecastData, climateData] = await Promise.all(fetches);
        days = [
          ...this._transformResponse(archiveData),
          ...this._transformResponse(forecastData),
          ...this._transformClimateResponse(climateData),
        ];
      } else {
        source = 'mixed';
        const clampedEnd = end > maxForecastDate
          ? this._formatDate(maxForecastDate) : endDate;

        fetches.push(
          this.client.getDailyForecast(
            roundedLat, roundedLon, todayStr, clampedEnd, 'auto'
          ),
        );

        const [archiveData, forecastData] = await Promise.all(fetches);
        days = [
          ...this._transformResponse(archiveData),
          ...this._transformResponse(forecastData),
        ];
      }
    }

    // Cache the result
    const result = { days, source };
    this.cache.set(cacheKey, result);

    return { ...result, cached: false };
  }

  /**
   * Transform Open-Meteo forecast/archive response to our format
   * @private
   */
  _transformResponse(data) {
    if (!data?.daily?.time) return [];

    const { time, temperature_2m_max, temperature_2m_min, weathercode, precipitation_sum } =
      data.daily;

    return time.map((date, i) => ({
      date,
      tempMax: temperature_2m_max[i],
      tempMin: temperature_2m_min[i],
      weatherCode: weathercode[i],
      precipitation: precipitation_sum[i],
      source: 'forecast',
    }));
  }

  /**
   * Transform Open-Meteo climate API response to our format.
   * Climate API does not provide weathercode, so we derive one
   * from precipitation_sum and cloud_cover_mean.
   * @private
   */
  _transformClimateResponse(data) {
    if (!data?.daily?.time) return [];

    const { time, temperature_2m_max, temperature_2m_min, precipitation_sum, cloud_cover_mean } =
      data.daily;

    return time.map((date, i) => ({
      date,
      tempMax: temperature_2m_max[i],
      tempMin: temperature_2m_min[i],
      weatherCode: this._deriveWeatherCode(precipitation_sum[i], cloud_cover_mean[i]),
      precipitation: precipitation_sum[i],
      source: 'climate',
    }));
  }

  /**
   * Derive a WMO-style weather code from precipitation and cloud cover.
   * This is an approximation for climate data which lacks native weather codes.
   * @private
   * @param {number} precipitation - Daily precipitation sum (mm)
   * @param {number} cloudCover - Mean cloud cover (%)
   * @returns {number} WMO weather code
   */
  _deriveWeatherCode(precipitation, cloudCover) {
    const precip = precipitation ?? 0;
    const clouds = cloudCover ?? 50;

    if (precip >= 10) return 65; // heavy rain
    if (precip >= 2) return 61; // rain
    if (precip >= 0.5) return 51; // drizzle
    if (clouds >= 80) return 3; // overcast
    if (clouds >= 50) return 2; // partly cloudy
    if (clouds >= 20) return 1; // mainly clear
    return 0; // clear sky
  }

  /**
   * Format date as YYYY-MM-DD
   * @private
   */
  _formatDate(date) {
    return date.toISOString().split('T')[0];
  }

  clearCache() {
    this.cache.clear();
  }
}

/**
 * Singleton instance
 */
let weatherServiceInstance;

/**
 * Get weather service instance (singleton)
 * @returns {WeatherService}
 */
export function getWeatherService() {
  if (!weatherServiceInstance) {
    weatherServiceInstance = new WeatherService();
  }
  return weatherServiceInstance;
}
