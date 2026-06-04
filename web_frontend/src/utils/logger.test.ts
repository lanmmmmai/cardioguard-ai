import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { logger } from './logger';

describe('logger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('luôn in error logs ra console kể cả trên production', () => {
    logger.error('Test error message');
    expect(console.error).toHaveBeenCalledWith('Test error message');
  });

  it('kiểm tra luồng in log phụ thuộc vào isDev', () => {
    if (import.meta.env.DEV) {
      logger.log('Test log');
      expect(console.log).toHaveBeenCalledWith('Test log');

      logger.debug('Test debug');
      expect(console.debug).toHaveBeenCalledWith('Test debug');

      logger.info('Test info');
      expect(console.info).toHaveBeenCalledWith('Test info');

      logger.warn('Test warn');
      expect(console.warn).toHaveBeenCalledWith('Test warn');
    } else {
      logger.log('Test log');
      expect(console.log).not.toHaveBeenCalled();

      logger.debug('Test debug');
      expect(console.debug).not.toHaveBeenCalled();
    }
  });
});
