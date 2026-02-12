/**
 * Unit tests for Route Optimizer Service
 * Tests route optimization, metrics calculation, and distance computation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  optimizeRoute,
  calculateRouteMetrics,
  calculateDistanceBetween,
} from '../../../src/services/route-optimizer.js';

// Mock logger to suppress output
vi.mock('../../../src/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Route Optimizer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper: create activity with coordinates
  function makeActivity(id, lat, lon) {
    return { id, latitude: lat, longitude: lon };
  }

  describe('optimizeRoute', () => {
    it('should return empty result when no activities have coordinates', () => {
      const activities = [
        { id: '1', latitude: null, longitude: null },
        { id: '2', latitude: null, longitude: null },
      ];

      const result = optimizeRoute(activities);

      expect(result.activities).toHaveLength(0);
      expect(result.totalDistance).toBe(0);
      expect(result.totalTravelTime).toBe(0);
    });

    it('should return single activity unchanged', () => {
      const activities = [makeActivity('1', 48.8566, 2.3522)];

      const result = optimizeRoute(activities);

      expect(result.activities).toHaveLength(1);
      expect(result.totalDistance).toBe(0);
      expect(result.totalTravelTime).toBe(0);
    });

    it('should optimize route with multiple activities using nearest neighbor', () => {
      // Paris -> Lyon -> Marseille (roughly south)
      const activities = [
        makeActivity('paris', 48.8566, 2.3522),
        makeActivity('marseille', 43.2965, 5.3698), // further from Paris
        makeActivity('lyon', 45.7640, 4.8357),      // closer to Paris
      ];

      const result = optimizeRoute(activities, { startPoint: 'first' });

      expect(result.activities).toHaveLength(3);
      // With nearest neighbor starting from Paris, Lyon should come before Marseille
      expect(result.activities[0].id).toBe('paris');
      expect(result.activities[1].id).toBe('lyon');
      expect(result.activities[2].id).toBe('marseille');
      expect(result.totalDistance).toBeGreaterThan(0);
      expect(result.totalTravelTime).toBeGreaterThan(0);
    });

    it('should filter out activities without coordinates', () => {
      const activities = [
        makeActivity('1', 48.8566, 2.3522),
        { id: '2', latitude: null, longitude: null },
        makeActivity('3', 45.7640, 4.8357),
      ];

      const result = optimizeRoute(activities);

      expect(result.activities).toHaveLength(2);
    });

    it('should use "nearest" start point strategy (southernmost)', () => {
      const activities = [
        makeActivity('north', 60.0, 10.0),
        makeActivity('south', 40.0, 10.0),
        makeActivity('mid', 50.0, 10.0),
      ];

      const result = optimizeRoute(activities, { startPoint: 'nearest' });

      // Should start from southernmost (lowest latitude)
      expect(result.activities[0].id).toBe('south');
    });

    it('should return rounded total distance', () => {
      const activities = [
        makeActivity('a', 48.8566, 2.3522),
        makeActivity('b', 48.8600, 2.3600),
      ];

      const result = optimizeRoute(activities);

      // Distance should be rounded to 2 decimal places
      expect(result.totalDistance.toString()).toMatch(/^\d+(\.\d{1,2})?$/);
    });
  });

  describe('calculateRouteMetrics', () => {
    it('should return zero metrics for fewer than 2 valid activities', () => {
      const result = calculateRouteMetrics([makeActivity('1', 48.8566, 2.3522)]);

      expect(result.totalDistance).toBe(0);
      expect(result.totalTravelTime).toBe(0);
      expect(result.segments).toHaveLength(0);
    });

    it('should return zero metrics for empty array', () => {
      const result = calculateRouteMetrics([]);

      expect(result.totalDistance).toBe(0);
      expect(result.segments).toHaveLength(0);
    });

    it('should calculate metrics for ordered activities', () => {
      const activities = [
        makeActivity('paris', 48.8566, 2.3522),
        makeActivity('lyon', 45.7640, 4.8357),
        makeActivity('marseille', 43.2965, 5.3698),
      ];

      const result = calculateRouteMetrics(activities);

      expect(result.segments).toHaveLength(2);
      expect(result.segments[0].from).toBe('paris');
      expect(result.segments[0].to).toBe('lyon');
      expect(result.segments[1].from).toBe('lyon');
      expect(result.segments[1].to).toBe('marseille');
      expect(result.totalDistance).toBeGreaterThan(0);
      expect(result.totalTravelTime).toBeGreaterThan(0);
    });

    it('should filter activities without coordinates', () => {
      const activities = [
        makeActivity('a', 48.8566, 2.3522),
        { id: 'b', latitude: null, longitude: null },
        makeActivity('c', 45.7640, 4.8357),
      ];

      const result = calculateRouteMetrics(activities);

      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].from).toBe('a');
      expect(result.segments[0].to).toBe('c');
    });

    it('should have segment distances that sum to total distance', () => {
      const activities = [
        makeActivity('a', 48.8566, 2.3522),
        makeActivity('b', 45.7640, 4.8357),
        makeActivity('c', 43.2965, 5.3698),
      ];

      const result = calculateRouteMetrics(activities);
      const segmentSum = result.segments.reduce((sum, s) => sum + s.distance, 0);

      // Allow small rounding tolerance
      expect(Math.abs(segmentSum - result.totalDistance)).toBeLessThan(0.02);
    });
  });

  describe('calculateDistanceBetween', () => {
    it('should calculate distance between two activities', () => {
      const activity1 = makeActivity('paris', 48.8566, 2.3522);
      const activity2 = makeActivity('lyon', 45.7640, 4.8357);

      const result = calculateDistanceBetween(activity1, activity2);

      expect(result.distance).toBeGreaterThan(300); // ~392 km
      expect(result.distance).toBeLessThan(500);
      expect(result.travelTime).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
    });

    it('should return null values when first activity has no coordinates', () => {
      const activity1 = { id: '1', latitude: null, longitude: 2.3522 };
      const activity2 = makeActivity('2', 45.7640, 4.8357);

      const result = calculateDistanceBetween(activity1, activity2);

      expect(result.distance).toBeNull();
      expect(result.travelTime).toBeNull();
      expect(result.error).toBeDefined();
    });

    it('should return null values when second activity has no coordinates', () => {
      const activity1 = makeActivity('1', 48.8566, 2.3522);
      const activity2 = { id: '2', latitude: 45.7640, longitude: null };

      const result = calculateDistanceBetween(activity1, activity2);

      expect(result.distance).toBeNull();
      expect(result.travelTime).toBeNull();
    });

    it('should return 0 distance for same location', () => {
      const activity1 = makeActivity('1', 48.8566, 2.3522);
      const activity2 = makeActivity('2', 48.8566, 2.3522);

      const result = calculateDistanceBetween(activity1, activity2);

      expect(result.distance).toBe(0);
      expect(result.travelTime).toBe(0);
    });

    it('should return rounded distance to 2 decimal places', () => {
      const activity1 = makeActivity('1', 48.8566, 2.3522);
      const activity2 = makeActivity('2', 48.8600, 2.3600);

      const result = calculateDistanceBetween(activity1, activity2);

      expect(result.distance.toString()).toMatch(/^\d+(\.\d{1,2})?$/);
    });
  });
});
