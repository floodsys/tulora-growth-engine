import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Sentry
const mockSentryInit = vi.fn();
const mockConfigureScope = vi.fn();
const mockAddBreadcrumb = vi.fn();
const mockCaptureMessage = vi.fn();
const mockGetCurrentHub = vi.fn();

vi.mock('@sentry/react', () => ({
  init: mockSentryInit,
  configureScope: mockConfigureScope,
  addBreadcrumb: mockAddBreadcrumb,
  captureMessage: mockCaptureMessage,
  getCurrentHub: mockGetCurrentHub,
  BrowserTracing: vi.fn(),
}));

// Mock build-info
vi.mock('../../lib/build-info', () => ({
  COMMIT_SHA: 'test-commit-sha-123456',
  BUILD_ID: 'test-build-id-789',
}));

// Mock import.meta.env
Object.defineProperty(globalThis, 'import', {
  value: {
    meta: {
      env: {
        VITE_SENTRY_DSN: 'https://test@sentry.io/123',
        VITE_ENABLE_SENTRY: 'true',
        VITE_SENTRY_ENVIRONMENT: 'test',
        VITE_REPO_NAME: 'test-repo',
        VITE_BUILD_TIMESTAMP: '2024-01-15T10:30:00.000Z',
      }
    }
  }
});

describe('Sentry Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentHub.mockReturnValue({
      getClient: vi.fn().mockReturnValue({}),
    });
  });

  describe('initializeSentry', () => {
    it('should initialize Sentry with correct release format', async () => {
      const { initializeSentry } = await import('../sentry');
      
      initializeSentry();
      
      expect(mockSentryInit).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: 'https://test@sentry.io/123',
          environment: 'test',
          release: 'test-repo@test-com',
          initialScope: expect.objectContaining({
            tags: {
              buildId: 'test-build-id-789',
              commitSha: 'test-commit-sha-123456',
            },
            contexts: {
              build: {
                id: 'test-build-id-789',
                commit: 'test-commit-sha-123456',
                timestamp: '2024-01-15T10:30:00.000Z',
              }
            }
          })
        })
      );
    });

    it('should not initialize when Sentry is disabled', async () => {
      // Override env for this test
      const originalMeta = (globalThis as any).import.meta;
      (globalThis as any).import.meta = {
        env: {
          VITE_ENABLE_SENTRY: 'false',
          VITE_SENTRY_DSN: 'https://test@sentry.io/123',
        }
      };
      
      const { initializeSentry } = await import('../sentry');
      
      initializeSentry();
      
      expect(mockSentryInit).not.toHaveBeenCalled();
      
      // Restore
      (globalThis as any).import.meta = originalMeta;
    });

    it('should not initialize when DSN is missing', async () => {
      // Override env for this test
      const originalMeta = (globalThis as any).import.meta;
      (globalThis as any).import.meta = {
        env: {
          VITE_ENABLE_SENTRY: 'true',
          // No DSN
        }
      };
      
      const { initializeSentry } = await import('../sentry');
      
      initializeSentry();
      
      expect(mockSentryInit).not.toHaveBeenCalled();
      
      // Restore
      (globalThis as any).import.meta = originalMeta;
    });
  });

  describe('captureDeployment', () => {
    it('should capture deployment breadcrumb and message', async () => {
      const { captureDeployment } = await import('../sentry');
      
      captureDeployment();
      
      expect(mockAddBreadcrumb).toHaveBeenCalledWith({
        category: 'deployment',
        message: 'Application deployed: test-repo@test-com',
        level: 'info',
        data: expect.objectContaining({
          release: 'test-repo@test-com',
          buildId: 'test-build-id-789',
          commitSha: 'test-commit-sha-123456',
        })
      });
      
      expect(mockCaptureMessage).toHaveBeenCalledWith(
        'Deployment: test-repo@test-com',
        'info'
      );
    });

    it('should not capture when Sentry is not initialized', async () => {
      mockGetCurrentHub.mockReturnValue({
        getClient: vi.fn().mockReturnValue(null),
      });
      
      const { captureDeployment } = await import('../sentry');
      
      captureDeployment();
      
      expect(mockAddBreadcrumb).not.toHaveBeenCalled();
      expect(mockCaptureMessage).not.toHaveBeenCalled();
    });
  });
});