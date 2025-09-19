import * as Sentry from '@sentry/react';
import { browserTracingIntegration } from '@sentry/react';
import { COMMIT_SHA, BUILD_ID } from './build-info';

export interface SentryConfig {
  dsn?: string;
  environment?: string;
  release?: string;
  enabled?: boolean;
}

/**
 * Initialize Sentry with release tracking
 * Gate behind environment variables for preview/dev
 */
export function initializeSentry(): void {
  // Check if Sentry should be enabled
  const sentryDsn = (import.meta as any).env?.VITE_SENTRY_DSN;
  const environment = (import.meta as any).env?.VITE_SENTRY_ENVIRONMENT || 'development';
  const enableSentry = (import.meta as any).env?.VITE_ENABLE_SENTRY === 'true';
  
  // Don't initialize in development unless explicitly enabled
  if (!enableSentry || !sentryDsn) {
    console.log('Sentry disabled:', { enableSentry, hasDsn: !!sentryDsn });
    return;
  }

  // Create release name: repo@shortSHA
  const repoName = (import.meta as any).env?.VITE_REPO_NAME || 'unknown-repo';
  const shortSha = COMMIT_SHA.substring(0, 8);
  const release = `${repoName}@${shortSha}`;

  try {
    Sentry.init({
      dsn: sentryDsn,
      environment,
      release,
      
      // Associate errors with this specific build
      initialScope: {
        tags: {
          buildId: BUILD_ID,
          commitSha: COMMIT_SHA,
        },
        contexts: {
          build: {
            id: BUILD_ID,
            commit: COMMIT_SHA,
            timestamp: (import.meta as any).env?.VITE_BUILD_TIMESTAMP,
          }
        }
      },

      // Configure based on environment
      integrations: [
        browserTracingIntegration(),
      ],
      
      // Performance monitoring
      tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
      
      // Session replay (only in production)
      replaysSessionSampleRate: environment === 'production' ? 0.1 : 0.0,
      replaysOnErrorSampleRate: environment === 'production' ? 1.0 : 0.0,

      beforeSend(event) {
        // Filter out common non-critical errors in development
        if (environment === 'development') {
          const message = event.message || event.exception?.values?.[0]?.value || '';
          if (message.includes('ChunkLoadError') || message.includes('Loading chunk')) {
            return null; // Don't send chunk loading errors in dev
          }
        }
        return event;
      },
    });

    // Set the release in the current scope
    Sentry.withScope((scope) => {
      scope.setTag('release', release);
      scope.setContext('deployment', {
        release,
        environment,
        buildId: BUILD_ID,
        commitSha: COMMIT_SHA,
      });
    });

    console.log(`Sentry initialized for release: ${release}`, { environment, buildId: BUILD_ID });
    
  } catch (error) {
    console.error('Failed to initialize Sentry:', error);
  }
}

/**
 * Manually capture a release event for deployment tracking
 */
export function captureDeployment(): void {
  try {
    const currentHub = Sentry.getClient();
    if (!currentHub) {
      return; // Sentry not initialized
    }

    const shortSha = COMMIT_SHA.substring(0, 8);
    const repoName = (import.meta as any).env?.VITE_REPO_NAME || 'unknown-repo';
    
    Sentry.addBreadcrumb({
      category: 'deployment',
      message: `Application deployed: ${repoName}@${shortSha}`,
      level: 'info',
      data: {
        release: `${repoName}@${shortSha}`,
        buildId: BUILD_ID,
        commitSha: COMMIT_SHA,
        timestamp: new Date().toISOString(),
      }
    });

    // Optional: Send a custom event for deployment tracking
    Sentry.captureMessage(`Deployment: ${repoName}@${shortSha}`, 'info');
    
  } catch (error) {
    console.error('Failed to capture deployment event:', error);
  }
}

export { Sentry };