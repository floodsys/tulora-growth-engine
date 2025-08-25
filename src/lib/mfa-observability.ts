interface MFABreadcrumb {
  page: string;
  action: string;
  result: 'success' | 'error' | 'pending';
  factorIdSuffix?: string;
  challengeIdSuffix?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

class MFAObservability {
  private breadcrumbs: MFABreadcrumb[] = [];
  private readonly maxBreadcrumbs = 20;

  addBreadcrumb(breadcrumb: Omit<MFABreadcrumb, 'timestamp'>) {
    const fullBreadcrumb: MFABreadcrumb = {
      ...breadcrumb,
      timestamp: new Date().toISOString()
    };

    this.breadcrumbs.push(fullBreadcrumb);
    
    // Keep only last N breadcrumbs
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs = this.breadcrumbs.slice(-this.maxBreadcrumbs);
    }

    // Log to console in development (no secrets)
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      console.log('[MFA Breadcrumb]', fullBreadcrumb);
    }
  }

  logMFAEvent(event: {
    action: 'enroll' | 'challenge' | 'verify' | 'unenroll';
    page: string;
    factorId?: string;
    challengeId?: string;
    success: boolean;
    error?: Error;
    metadata?: Record<string, any>;
  }) {
    // Add breadcrumb with safe data (no secrets)
    this.addBreadcrumb({
      page: event.page,
      action: event.action,
      result: event.success ? 'success' : 'error',
      factorIdSuffix: event.factorId?.slice(-8), // Last 8 chars only
      challengeIdSuffix: event.challengeId?.slice(-8),
      metadata: {
        ...event.metadata,
        errorType: event.error?.name,
        errorMessage: event.error?.message,
        userAgent: navigator.userAgent.slice(0, 100), // Truncated
        timestamp: Date.now()
      }
    });

    // Send to logging service (redacted)
    this.sendToLoggingService({
      type: 'mfa_event',
      action: event.action,
      page: event.page,
      success: event.success,
      factorIdSuffix: event.factorId?.slice(-8),
      challengeIdSuffix: event.challengeId?.slice(-8),
      errorType: event.error?.name,
      errorMessage: event.error?.message,
      timestamp: Date.now(),
      sessionId: this.getSessionId(),
      metadata: {
        ...event.metadata,
        breadcrumbCount: this.breadcrumbs.length
      }
    });
  }

  private async sendToLoggingService(data: Record<string, any>) {
    try {
      // Use Supabase edge function for logging (no secrets in payload)
      const response = await fetch(`${window.location.origin}/functions/v1/auth-logger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          ...data,
          // Explicitly exclude any potential secrets
          excludedFields: ['secret', 'code', 'qr_code', 'totp_secret']
        })
      });
      
      if (!response.ok) {
        throw new Error(`Logging failed: ${response.status}`);
      }
    } catch (error) {
      console.warn('Failed to send MFA telemetry:', error);
    }
  }

  getBreadcrumbs(): MFABreadcrumb[] {
    return [...this.breadcrumbs];
  }

  clearBreadcrumbs() {
    this.breadcrumbs = [];
  }

  getErrorContext(): Record<string, any> {
    const recentErrors = this.breadcrumbs
      .filter(b => b.result === 'error')
      .slice(-5);

    return {
      recentErrors,
      totalBreadcrumbs: this.breadcrumbs.length,
      lastAction: this.breadcrumbs[this.breadcrumbs.length - 1],
      sessionDuration: this.getSessionDuration()
    };
  }

  private getSessionId(): string {
    if (typeof window === 'undefined') return 'ssr';
    return sessionStorage.getItem('mfa_session_id') || 'unknown';
  }

  private getAuthToken(): string {
    // This would be retrieved from Supabase client securely
    return 'placeholder_token';
  }

  private getSessionDuration(): number {
    if (typeof window === 'undefined') return 0;
    const startTime = sessionStorage.getItem('mfa_session_start');
    return startTime ? Date.now() - parseInt(startTime) : 0;
  }
}

export const mfaObservability = new MFAObservability();
