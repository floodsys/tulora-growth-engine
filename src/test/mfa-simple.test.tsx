import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { MFASetup } from '@/components/admin/MFASetup';
import { MFAVerification } from '@/components/admin/MFAVerification';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { 
          session: { 
            user: { id: 'test-user-id', email: 'test@example.com' } 
          } 
        }
      }),
      getUser: vi.fn().mockResolvedValue({
        data: { 
          user: { id: 'test-user-id', email: 'test@example.com' } 
        }
      }),
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
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock observability
vi.mock('@/lib/mfa-observability', () => ({
  mfaObservability: {
    logMFAEvent: vi.fn(),
    addBreadcrumb: vi.fn(),
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

describe('MFA Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('MFASetup', () => {
    it('should render setup component without crashing', () => {
      const mockOnComplete = vi.fn();
      const mockOnCancel = vi.fn();

      const { container } = render(
        <TestWrapper>
          <MFASetup onSetupComplete={mockOnComplete} onCancel={mockOnCancel} />
        </TestWrapper>
      );

      expect(container).toBeInTheDocument();
    });
  });

  describe('MFAVerification', () => {
    it('should render verification component without crashing', () => {
      const mockOnSuccess = vi.fn();
      const mockOnCancel = vi.fn();

      const { container } = render(
        <TestWrapper>
          <MFAVerification 
            onVerificationSuccess={mockOnSuccess}
            onCancel={mockOnCancel}
          />
        </TestWrapper>
      );

      expect(container).toBeInTheDocument();
    });
  });
});