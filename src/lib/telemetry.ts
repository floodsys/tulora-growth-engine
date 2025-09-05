// Generate a session correlation ID for tracking user flows
const generateCorrelationId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Get or create session correlation ID
const getSessionCorrelationId = (): string => {
  const key = 'session_correlation_id';
  let correlationId = sessionStorage.getItem(key);
  
  if (!correlationId) {
    correlationId = generateCorrelationId();
    sessionStorage.setItem(key, correlationId);
  }
  
  return correlationId;
};

interface TelemetryEvent {
  event: string;
  properties: Record<string, any>;
  correlationId: string;
  timestamp: string;
}

export const telemetry = {
  track: (event: string, properties: Record<string, any> = {}) => {
    const telemetryEvent: TelemetryEvent = {
      event,
      properties: {
        ...properties,
        // Add environment context (no PII)
        userAgent: navigator.userAgent,
        url: window.location.pathname,
        referrer: document.referrer || 'direct',
      },
      correlationId: getSessionCorrelationId(),
      timestamp: new Date().toISOString(),
    };

    // For now, log to console - could easily be extended to send to analytics service
    console.log('[Telemetry]', telemetryEvent);

    // TODO: Send to analytics service
    // Example: sendToAnalyticsService(telemetryEvent);
  },

  // Specific event helpers
  signupStepCompleted: (step: 'account' | 'organization', method: 'email' | 'google') => {
    telemetry.track('signup_step_completed', { step, method });
  },

  profileSaved: (source: 'signup' | 'onboarding') => {
    telemetry.track('profile_saved', { source });
  },

  // Clear correlation ID when user signs out
  clearSession: () => {
    sessionStorage.removeItem('session_correlation_id');
  },
};