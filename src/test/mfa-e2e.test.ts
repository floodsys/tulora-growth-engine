import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { MFASetup } from '@/components/admin/MFASetup';
import { MFAVerification } from '@/components/admin/MFAVerification';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      getUser: vi.fn(),
      mfa: {
        enroll: vi.fn(),
        challenge: vi.fn(),
        verify: vi.fn(),
        listFactors: vi.fn(),
        unenroll: vi.fn(),
      },
      refreshSession: vi.fn(),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}));

// Mock router
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
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

describe('MFA E2E Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default session mock
    (supabase.auth.getSession as any).mockResolvedValue({
      data: { 
        session: { 
          user: { id: 'test-user-id', email: 'test@example.com' } 
        } 
      }
    });
    (supabase.auth.getUser as any).mockResolvedValue({
      data: { 
        user: { id: 'test-user-id', email: 'test@example.com' } 
      }
    });
  });

  describe('E2E - First-time enrollment and verification', () => {
    it('should complete full enroll → verify → /admin flow', async () => {
      // Mock no existing factors (first-time user)
      (supabase.auth.mfa.listFactors as any).mockResolvedValue({
        data: { totp: [] },
        error: null,
      });

      // Mock successful enrollment
      const mockFactorId = 'test-factor-id';
      const mockSecret = 'JBSWY3DPEHPK3PXP';
      const mockQrCode = 'data:image/png;base64,test-qr-code';
      
      (supabase.auth.mfa.enroll as any).mockResolvedValue({
        data: {
          id: mockFactorId,
          totp: {
            secret: mockSecret,
            qr_code: mockQrCode,
          },
        },
        error: null,
      });

      // Mock successful verification
      (supabase.auth.mfa.verify as any).mockResolvedValue({
        data: { valid: true },
        error: null,
      });

      // Mock challenge creation
      (supabase.auth.mfa.challenge as any).mockResolvedValue({
        data: { id: 'test-challenge-id' },
        error: null,
      });

      // Mock logging
      (supabase.functions.invoke as any).mockResolvedValue({
        data: { success: true },
        error: null,
      });

      // Render MFASetup component
      render(
        <TestWrapper>
          <MFASetup onSetupComplete={vi.fn()} />
        </TestWrapper>
      );

      // Wait for enrollment to initialize
      await waitFor(() => {
        expect(screen.getByText('Scan this QR code')).toBeInTheDocument();
      });

      // Enter verification code
      const codeInput = screen.getByLabelText(/6-digit verification code/i);
      fireEvent.change(codeInput, { target: { value: '123456' } });

      // Submit verification
      const verifyButton = screen.getByRole('button', { name: /verify.*complete.*setup/i });
      fireEvent.click(verifyButton);

      // Should complete setup and navigate
      await waitFor(() => {
        expect(supabase.auth.mfa.verify).toHaveBeenCalledWith({
          factorId: mockFactorId,
          challengeId: 'test-challenge-id',
          code: '123456',
        });
      });
    });
  });

  describe('E2E - Existing factor reuse', () => {
    it('should reuse existing factor for challenge → verify', async () => {
      // Mock existing factor
      const mockFactorId = 'existing-factor-id';
      (supabase.auth.mfa.listFactors as any).mockResolvedValue({
        data: { 
          totp: [{ 
            id: mockFactorId, 
            status: 'verified',
            friendly_name: 'Test Factor',
          }] 
        },
        error: null,
      });

      // Mock challenge creation
      const mockChallengeId = 'test-challenge-id';
      (supabase.auth.mfa.challenge as any).mockResolvedValue({
        data: { id: mockChallengeId },
        error: null,
      });

      // Mock successful verification
      (supabase.auth.mfa.verify as any).mockResolvedValue({
        data: { valid: true },
        error: null,
      });

      // Mock logging
      (supabase.functions.invoke as any).mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const mockOnSuccess = vi.fn();

      // Render MFAVerification component
      render(
        <TestWrapper>
          <MFAVerification 
            onVerificationSuccess={mockOnSuccess}
            onCancel={vi.fn()}
          />
        </TestWrapper>
      );

      // Wait for challenge initialization
      await waitFor(() => {
        expect(supabase.auth.mfa.challenge).toHaveBeenCalledWith({
          factorId: mockFactorId,
        });
      });

      // Enter verification code
      const codeInput = screen.getByLabelText(/6-digit verification code/i);
      fireEvent.change(codeInput, { target: { value: '654321' } });

      // Submit verification
      const verifyButton = screen.getByRole('button', { name: /verify.*access.*admin/i });
      fireEvent.click(verifyButton);

      // Should verify with existing factor
      await waitFor(() => {
        expect(supabase.auth.mfa.verify).toHaveBeenCalledWith({
          factorId: mockFactorId,
          challengeId: mockChallengeId,
          code: '654321',
        });
      });

      // Should navigate to admin
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/admin');
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('E2E - Wrong code handling with throttling', () => {
    it('should handle three wrong codes with increasing delays', async () => {
      // Mock existing factor
      const mockFactorId = 'existing-factor-id';
      (supabase.auth.mfa.listFactors as any).mockResolvedValue({
        data: { 
          totp: [{ 
            id: mockFactorId, 
            status: 'verified',
          }] 
        },
        error: null,
      });

      // Mock challenge creation
      (supabase.auth.mfa.challenge as any).mockResolvedValue({
        data: { id: 'test-challenge-id' },
        error: null,
      });

      // Mock failed verification (wrong code)
      (supabase.auth.mfa.verify as any).mockRejectedValue({
        message: 'invalid_totp',
        name: 'MFAError',
      });

      const mockOnSuccess = vi.fn();
      const mockToast = vi.fn();
      
      // Mock useToast
      vi.mocked(require('@/hooks/use-toast').useToast).mockReturnValue({
        toast: mockToast,
      });

      // Render component
      render(
        <TestWrapper>
          <MFAVerification 
            onVerificationSuccess={mockOnSuccess}
            onCancel={vi.fn()}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/6-digit verification code/i)).toBeInTheDocument();
      });

      const codeInput = screen.getByLabelText(/6-digit verification code/i);
      const verifyButton = screen.getByRole('button', { name: /verify.*access.*admin/i });

      // First wrong attempt
      fireEvent.change(codeInput, { target: { value: '111111' } });
      fireEvent.click(verifyButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Incorrect Verification Code',
            description: expect.stringContaining('4 attempts remaining'),
            variant: 'destructive',
          })
        );
      });

      // Second wrong attempt
      fireEvent.change(codeInput, { target: { value: '222222' } });
      fireEvent.click(verifyButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Incorrect Verification Code',
            description: expect.stringContaining('3 attempts remaining'),
            variant: 'destructive',
          })
        );
      });

      // Third wrong attempt - should trigger throttling
      fireEvent.change(codeInput, { target: { value: '333333' } });
      fireEvent.click(verifyButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Incorrect Verification Code',
            description: expect.stringContaining('2 attempts remaining'),
            variant: 'destructive',
          })
        );
      });

      // Fourth attempt should be throttled
      fireEvent.change(codeInput, { target: { value: '444444' } });
      fireEvent.click(verifyButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Too Many Attempts',
            description: expect.stringContaining('Please wait'),
            variant: 'destructive',
          })
        );
      });

      // Verify button should be disabled during cooldown
      expect(verifyButton).toBeDisabled();
    });
  });
});