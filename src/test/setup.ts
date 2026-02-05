import { beforeAll, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Global ResizeObserver stub for jsdom
class ResizeObserverStub {
  observe() { }
  unobserve() { }
  disconnect() { }
}
globalThis.ResizeObserver = ResizeObserverStub as any;

// Setup DOM environment
beforeAll(() => {
  // Mock environment variables for testing
  Object.defineProperty(import.meta, 'env', {
    value: {
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      VITE_SUPERADMINS_EMAILS: 'test@admin.com', // Cosmetic only
      MODE: 'test',
    },
    writable: true,
  });
});

// Cleanup after each test
afterEach(() => {
  cleanup();
});