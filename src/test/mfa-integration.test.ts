import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { useMFAVerification } from '@/hooks/useMFAVerification';
import { useMFAAttemptThrottling } from '@/hooks/useMFAAttemptThrottling';
import { MFAObservability } from '@/lib/mfa-observability';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      getUser: vi.fn(),
      mfa: {
        listFactors: vi.fn(),
        challenge: vi.fn(),
        verify: vi.fn(),
      },
      refreshSession: vi.fn(),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}));

// Mock observability
vi.mock('@/lib/mfa-observability', () => ({
  MFAObservability: {
    logMFAEvent: vi.fn(),
    addBreadcrumb: vi.fn(),
    captureException: vi.fn(),
  },
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          {children}
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

// Test component for useMFAVerification hook
const TestMFAVerificationComponent = ({ isSuperadmin }: { isSuperadmin: boolean }) => {
  const mfaStatus = useMFAVerification(isSuperadmin);
  
  return (
    <div>
      <div data-testid="is-enrolled">{mfaStatus.isEnrolled.toString()}</div>
      <div data-testid="is-verified">{mfaStatus.isVerified.toString()}</div>
      <div data-testid="needs-setup">{mfaStatus.needsSetup.toString()}</div>
      <div data-testid="needs-verification">{mfaStatus.needsVerification.toString()}</div>
      <div data-testid="is-loading">{mfaStatus.isLoading.toString()}</div>
      <button onClick={() => mfaStatus.refreshMFAStatus()}>Refresh</button>
      <button onClick={() => mfaStatus.markAsVerified()}>Mark Verified</button>
      <button onClick={() => mfaStatus.clearVerification()}>Clear Verification</button>
    </div>
  );
};

// Test component for throttling hook
const TestThrottlingComponent = ({ maxAttempts, cooldownMs }: { maxAttempts: number; cooldownMs: number }) => {
  const throttling = useMFAAttemptThrottling(maxAttempts, cooldownMs);
  
  return (
    <div>
      <div data-testid="can-attempt">{throttling.canAttempt.toString()}</div>
      <div data-testid="attempts-left">{throttling.attemptsLeft}</div>
      <div data-testid="cooldown-time">{throttling.cooldownTime}</div>
      <button onClick={() => throttling.recordFailedAttempt()}>Record Failed Attempt</button>
      <button onClick={() => throttling.reset()}>Reset</button>
    </div>
  );
};

describe('MFA Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('useMFAVerification Hook', () => {
    it('should handle non-superadmin users correctly', async () => {
      render(
        <TestWrapper>
          <TestMFAVerificationComponent isSuperadmin={false} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-enrolled')).toHaveTextContent('true');
        expect(screen.getByTestId('is-verified')).toHaveTextContent('true');
        expect(screen.getByTestId('needs-setup')).toHaveTextContent('false');
        expect(screen.getByTestId('needs-verification')).toHaveTextContent('false');
        expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
      });
    });

    it('should handle superadmin with no factors (needs setup)', async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      
      // Mock no factors
      (supabase.auth.mfa.listFactors as any).mockResolvedValue({
        data: { totp: [] },
        error: null,
      });

      render(
        <TestWrapper>
          <TestMFAVerificationComponent isSuperadmin={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-enrolled')).toHaveTextContent('false');
        expect(screen.getByTestId('is-verified')).toHaveTextContent('false');
        expect(screen.getByTestId('needs-setup')).toHaveTextContent('true');
        expect(screen.getByTestId('needs-verification')).toHaveTextContent('false');
        expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
      });
    });

    it('should handle superadmin with factors but expired verification', async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      
      // Mock existing factors
      (supabase.auth.mfa.listFactors as any).mockResolvedValue({
        data: { totp: [{ id: 'factor-id', status: 'verified' }] },
        error: null,
      });

      // No valid verification in localStorage
      localStorage.removeItem('superadmin_mfa_verified');

      render(
        <TestWrapper>
          <TestMFAVerificationComponent isSuperadmin={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-enrolled')).toHaveTextContent('true');
        expect(screen.getByTestId('is-verified')).toHaveTextContent('false');
        expect(screen.getByTestId('needs-setup')).toHaveTextContent('false');
        expect(screen.getByTestId('needs-verification')).toHaveTextContent('true');
        expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
      });
    });

    it('should handle valid MFA verification', async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      
      // Mock existing factors
      (supabase.auth.mfa.listFactors as any).mockResolvedValue({
        data: { totp: [{ id: 'factor-id', status: 'verified' }] },
        error: null,
      });

      // Set valid verification in localStorage (future timestamp)
      const validUntil = Date.now() + 12 * 60 * 60 * 1000; // 12 hours from now
      localStorage.setItem('superadmin_mfa_verified', validUntil.toString());

      render(
        <TestWrapper>
          <TestMFAVerificationComponent isSuperadmin={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-enrolled')).toHaveTextContent('true');
        expect(screen.getByTestId('is-verified')).toHaveTextContent('true');
        expect(screen.getByTestId('needs-setup')).toHaveTextContent('false');
        expect(screen.getByTestId('needs-verification')).toHaveTextContent('false');
        expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
      });
    });

    it('should allow marking as verified and clearing verification', async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      
      // Mock existing factors
      (supabase.auth.mfa.listFactors as any).mockResolvedValue({
        data: { totp: [{ id: 'factor-id', status: 'verified' }] },
        error: null,
      });

      render(
        <TestWrapper>
          <TestMFAVerificationComponent isSuperadmin={true} />
        </TestWrapper>
      );

      // Initially needs verification
      await waitFor(() => {
        expect(screen.getByTestId('needs-verification')).toHaveTextContent('true');
      });

      // Mark as verified
      fireEvent.click(screen.getByText('Mark Verified'));

      await waitFor(() => {
        expect(screen.getByTestId('is-verified')).toHaveTextContent('true');
        expect(screen.getByTestId('needs-verification')).toHaveTextContent('false');
      });

      // Clear verification
      fireEvent.click(screen.getByText('Clear Verification'));

      await waitFor(() => {
        expect(screen.getByTestId('is-verified')).toHaveTextContent('false');
        expect(screen.getByTestId('needs-verification')).toHaveTextContent('true');
      });
    });
  });

  describe('useMFAAttemptThrottling Hook', () => {
    it('should allow attempts initially', () => {
      render(
        <TestWrapper>
          <TestThrottlingComponent maxAttempts={5} cooldownMs={2000} />
        </TestWrapper>
      );

      expect(screen.getByTestId('can-attempt')).toHaveTextContent('true');
      expect(screen.getByTestId('attempts-left')).toHaveTextContent('5');
      expect(screen.getByTestId('cooldown-time')).toHaveTextContent('0');
    });

    it('should throttle after max attempts', () => {
      render(
        <TestWrapper>
          <TestThrottlingComponent maxAttempts={3} cooldownMs={2000} />
        </TestWrapper>
      );

      // Make 3 failed attempts
      fireEvent.click(screen.getByText('Record Failed Attempt'));
      fireEvent.click(screen.getByText('Record Failed Attempt'));
      fireEvent.click(screen.getByText('Record Failed Attempt'));

      expect(screen.getByTestId('can-attempt')).toHaveTextContent('false');
      expect(screen.getByTestId('attempts-left')).toHaveTextContent('0');
      expect(parseInt(screen.getByTestId('cooldown-time').textContent || '0')).toBeGreaterThan(0);
    });

    it('should reset throttling', () => {
      render(
        <TestWrapper>
          <TestThrottlingComponent maxAttempts={3} cooldownMs={2000} />
        </TestWrapper>
      );

      // Make failed attempts
      fireEvent.click(screen.getByText('Record Failed Attempt'));
      fireEvent.click(screen.getByText('Record Failed Attempt'));

      expect(screen.getByTestId('attempts-left')).toHaveTextContent('1');

      // Reset
      fireEvent.click(screen.getByText('Reset'));

      expect(screen.getByTestId('can-attempt')).toHaveTextContent('true');
      expect(screen.getByTestId('attempts-left')).toHaveTextContent('3');
      expect(screen.getByTestId('cooldown-time')).toHaveTextContent('0');
    });
  });

  describe('MFA Observability', () => {
    it('should log MFA events without secrets', () => {
      MFAObservability.logMFAEvent('enroll_start', {
        factorId: 'test-factor-id',
        success: true,
      });

      expect(MFAObservability.logMFAEvent).toHaveBeenCalledWith('enroll_start', {
        factorId: 'test-factor-id',
        success: true,
      });
    });

    it('should add breadcrumbs for traceability', () => {
      MFAObservability.addBreadcrumb('mfa_challenge_created', {
        challengeId: 'challenge-123',
        factorId: 'factor-456',
      });

      expect(MFAObservability.addBreadcrumb).toHaveBeenCalledWith('mfa_challenge_created', {
        challengeId: 'challenge-123',
        factorId: 'factor-456',
      });
    });

    it('should capture exceptions with context', () => {
      const error = new Error('MFA verification failed');
      MFAObservability.captureException(error, {
        context: 'mfa_verification',
        factorId: 'factor-789',
        attemptNumber: 3,
      });

      expect(MFAObservability.captureException).toHaveBeenCalledWith(error, {
        context: 'mfa_verification',
        factorId: 'factor-789',
        attemptNumber: 3,
      });
    });
  });
});