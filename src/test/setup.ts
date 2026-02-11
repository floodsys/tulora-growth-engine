import { beforeAll, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Polyfill ResizeObserver for jsdom (used by Radix UI components)
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    private cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) { this.cb = cb; }
    observe() { }
    unobserve() { }
    disconnect() { }
  };
}

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