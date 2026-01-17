
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import logger from '../../../src/utils/logger.js';

describe('Logger Utility', () => {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  beforeEach(() => {
    vi.resetModules();
    console.log = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();
  });

  afterEach(() => {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
    delete process.env.LOG_LEVEL;
  });

  it('should log info messages by default', () => {
    logger.info('test message');
    expect(console.log).toHaveBeenCalled();
  });

  it('should not log debug messages by default', () => {
    logger.debug('test message');
    expect(console.log).not.toHaveBeenCalled();
  });

  it('should log debug messages when LOG_LEVEL is debug', async () => {
    process.env.LOG_LEVEL = 'debug';
    // Re-import the logger to apply the new LOG_LEVEL
    const module = await import('../../../src/utils/logger.js');
    module.default.debug('test message');
    expect(console.log).toHaveBeenCalled();
  });

  it('should format log as JSON', () => {
    logger.info('test message', { key: 'value' });
    const logOutput = JSON.parse(vi.mocked(console.log).mock.calls[0][0]);
    expect(logOutput.level).toBe('info');
    expect(logOutput.message).toBe('test message');
    expect(logOutput.key).toBe('value');
  });

  it('should create a child logger with context', () => {
    const child = logger.child({ service: 'test-service' });
    child.info('child message');
    const logOutput = JSON.parse(vi.mocked(console.log).mock.calls[0][0]);
    expect(logOutput.service).toBe('test-service');
    expect(logOutput.message).toBe('child message');
  });
});
