import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Sentry — all named exports that sentry.ts touches
const mockSentryInit = vi.fn();
const mockAddBreadcrumb = vi.fn();
const mockCaptureMessage = vi.fn();
const mockGetClient = vi.fn();
const mockWithScope = vi.fn((cb: (scope: any) => void) =>
  cb({ setTag: vi.fn(), setContext: vi.fn() }),
);

vi.mock('@sentry/react', () => ({
  init: mockSentryInit,
  addBreadcrumb: mockAddBreadcrumb,
  captureMessage: mockCaptureMessage,
  getClient: mockGetClient,
  withScope: mockWithScope,
  browserTracingIntegration: vi.fn(),
  BrowserTracing: vi.fn(),
}));

// Mock build-info
vi.mock('../../lib/build-info', () => ({
  COMMIT_SHA: 'test-commit-sha-123456',
  BUILD_ID: 'test-build-id-789',
}));

// Import the module under test (env vars are read at call-time, not import-time)
const { initializeSentry, captureDeployment } = await import('../sentry');

describe('Sentry Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClient.mockReturnValue({});
  });

  describe('initializeSentry', () => {
    it('should be a callable function', () => {
      expect(typeof initializeSentry).toBe('function');
    });

    it('should not initialize when Sentry is disabled (no env vars set)', () => {
      // In the test environment VITE_ENABLE_SENTRY is not set,
      // so initializeSentry should gracefully skip initialization.
      initializeSentry();
      expect(mockSentryInit).not.toHaveBeenCalled();
    });

    it('should not throw when called without env configuration', () => {
      expect(() => initializeSentry()).not.toThrow();
    });
  });

  describe('captureDeployment', () => {
    it('should capture deployment breadcrumb and message when Sentry client exists', () => {
      captureDeployment();

      // In test env VITE_REPO_NAME is unset → falls back to 'unknown-repo'
      expect(mockAddBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'deployment',
          level: 'info',
          data: expect.objectContaining({
            buildId: 'test-build-id-789',
            commitSha: 'test-commit-sha-123456',
          }),
        })
      );

      expect(mockCaptureMessage).toHaveBeenCalledWith(
        expect.stringContaining('Deployment:'),
        'info'
      );
    });

    it('should not capture when Sentry is not initialized', () => {
      mockGetClient.mockReturnValue(null);

      captureDeployment();

      expect(mockAddBreadcrumb).not.toHaveBeenCalled();
      expect(mockCaptureMessage).not.toHaveBeenCalled();
    });
  });
});
