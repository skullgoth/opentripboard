import { describe, it, expect, beforeEach } from 'vitest';
import { getItem, setItem, removeItem, clear, hasItem, getAllKeys } from '../../../src/utils/storage.js';

describe('Storage Utility', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('setItem', () => {
    it('should store a string value as JSON', () => {
      setItem('key', 'value');
      expect(localStorage.getItem('key')).toBe('"value"');
    });

    it('should store an object as JSON', () => {
      setItem('key', { name: 'test' });
      expect(localStorage.getItem('key')).toBe('{"name":"test"}');
    });

    it('should store a number as JSON', () => {
      setItem('key', 42);
      expect(localStorage.getItem('key')).toBe('42');
    });

    it('should remove key when value is null', () => {
      setItem('key', 'value');
      setItem('key', null);
      expect(localStorage.getItem('key')).toBeNull();
    });

    it('should remove key when value is undefined', () => {
      setItem('key', 'value');
      setItem('key', undefined);
      expect(localStorage.getItem('key')).toBeNull();
    });
  });

  describe('getItem', () => {
    it('should return parsed JSON value', () => {
      localStorage.setItem('key', '"value"');
      expect(getItem('key')).toBe('value');
    });

    it('should return parsed object', () => {
      localStorage.setItem('key', '{"name":"test"}');
      expect(getItem('key')).toEqual({ name: 'test' });
    });

    it('should return null for missing key', () => {
      expect(getItem('nonexistent')).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      localStorage.setItem('key', 'not-json');
      expect(getItem('key')).toBeNull();
    });
  });

  describe('removeItem', () => {
    it('should remove an item', () => {
      localStorage.setItem('key', '"value"');
      removeItem('key');
      expect(localStorage.getItem('key')).toBeNull();
    });

    it('should not throw for nonexistent key', () => {
      expect(() => removeItem('nonexistent')).not.toThrow();
    });
  });

  describe('clear', () => {
    it('should remove all items', () => {
      localStorage.setItem('key1', '"a"');
      localStorage.setItem('key2', '"b"');
      clear();
      expect(localStorage.length).toBe(0);
    });
  });

  describe('hasItem', () => {
    it('should return true for existing key', () => {
      localStorage.setItem('key', '"value"');
      expect(hasItem('key')).toBe(true);
    });

    it('should return false for nonexistent key', () => {
      expect(hasItem('nonexistent')).toBe(false);
    });
  });

  describe('getAllKeys', () => {
    it('should return all keys', () => {
      localStorage.setItem('a', '1');
      localStorage.setItem('b', '2');
      const keys = getAllKeys();
      expect(keys).toContain('a');
      expect(keys).toContain('b');
    });

    it('should return empty array when empty', () => {
      expect(getAllKeys()).toEqual([]);
    });
  });
});
