import { describe, it, expect } from 'vitest';
import { COMMIT_SHA, BUILD_ID, BUILD_TIMESTAMP, getBuildInfo } from '../build-info';

describe('build-info', () => {
  describe('COMMIT_SHA', () => {
    it('should be defined', () => {
      expect(COMMIT_SHA).toBeDefined();
      expect(typeof COMMIT_SHA).toBe('string');
    });

    it('should have valid length in production', () => {
      // In production, commit SHA should be 7-40 characters (short or full SHA)
      // In development, it might be 'unknown'
      if (import.meta.env.PROD || (COMMIT_SHA !== 'unknown' && COMMIT_SHA !== '')) {
        expect(COMMIT_SHA.length).toBeGreaterThanOrEqual(7);
        expect(COMMIT_SHA.length).toBeLessThanOrEqual(40);
        expect(COMMIT_SHA).toMatch(/^[a-f0-9]+$/i); // Should be hexadecimal
      }
    });

    it('should not be empty string', () => {
      expect(COMMIT_SHA).not.toBe('');
    });
  });

  describe('BUILD_ID', () => {
    it('should be defined and non-empty', () => {
      expect(BUILD_ID).toBeDefined();
      expect(typeof BUILD_ID).toBe('string');
      expect(BUILD_ID.length).toBeGreaterThan(0);
    });

    it('should contain meaningful parts', () => {
      // BUILD_ID should contain some identifying information
      expect(BUILD_ID).toMatch(/^.+-.+-.+$/); // Should have at least 2 hyphens
    });
  });

  describe('BUILD_TIMESTAMP', () => {
    it('should be defined and non-empty', () => {
      expect(BUILD_TIMESTAMP).toBeDefined();
      expect(typeof BUILD_TIMESTAMP).toBe('string');
      expect(BUILD_TIMESTAMP.length).toBeGreaterThan(0);
    });

    it('should be valid ISO 8601 format', () => {
      // Should be parseable as a date
      const date = new Date(BUILD_TIMESTAMP);
      expect(date.toISOString()).toBe(BUILD_TIMESTAMP);
      
      // Should match ISO 8601 format
      expect(BUILD_TIMESTAMP).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);
    });

    it('should represent a reasonable date', () => {
      const date = new Date(BUILD_TIMESTAMP);
      const now = new Date();
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

      // Build timestamp should be within reasonable bounds
      expect(date.getTime()).toBeGreaterThan(oneYearAgo.getTime());
      expect(date.getTime()).toBeLessThan(oneHourFromNow.getTime());
    });
  });

  describe('getBuildInfo()', () => {
    it('should return all required fields', () => {
      const buildInfo = getBuildInfo();
      
      expect(buildInfo).toHaveProperty('commitSha');
      expect(buildInfo).toHaveProperty('buildId');
      expect(buildInfo).toHaveProperty('buildTimestamp');
      expect(buildInfo).toHaveProperty('userAgent');
      expect(buildInfo).toHaveProperty('url');
      expect(buildInfo).toHaveProperty('timestamp');
      
      expect(buildInfo.commitSha).toBe(COMMIT_SHA);
      expect(buildInfo.buildId).toBe(BUILD_ID);
      expect(buildInfo.buildTimestamp).toBe(BUILD_TIMESTAMP);
    });

    it('should include runtime information', () => {
      const buildInfo = getBuildInfo();
      
      expect(typeof buildInfo.userAgent).toBe('string');
      expect(typeof buildInfo.url).toBe('string');
      expect(typeof buildInfo.timestamp).toBe('string');
      
      // Runtime timestamp should be valid ISO
      const runtimeDate = new Date(buildInfo.timestamp);
      expect(runtimeDate.toISOString()).toBe(buildInfo.timestamp);
    });
  });
});