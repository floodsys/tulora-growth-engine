import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { AdminSecurityWrapper } from '@/components/AdminSecurityWrapper';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      getUser: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ 
        data: { subscription: { unsubscribe: vi.fn() } } 
      })),
      mfa: {
        listFactors: vi.fn(),
        challenge: vi.fn(),
        verify: vi.fn(),
      },
    },
    rpc: vi.fn(),
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
          <Routes>
            <Route path="/admin" element={
              <AdminSecurityWrapper>
                <div>Admin Dashboard</div>
              </AdminSecurityWrapper>
            } />
            <Route path="/auth" element={<div>Auth Page</div>} />
            <Route path="/dashboard" element={<div>Dashboard</div>} />
            <Route path="*" element={children} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('MFA Route Guard Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage
    localStorage.clear();
  });

  describe('Route Guard - Auth not ready', () => {
    it('should show loading when auth is not ready', async () => {
      // Mock no session (auth loading)
      (supabase.auth.getSession as any).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ data: { session: null } }), 100))
      );
      
      (supabase.auth.getUser as any).mockResolvedValue({
        data: { user: null }
      });

      // Mock not superadmin
      (supabase.rpc as any).mockResolvedValue({
        data: false,
        error: null,
      });

      render(
        <TestWrapper>
          <div>Test Component</div>
        </TestWrapper>
      );

      // Should show loading state initially
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
  });

  describe('Route Guard - Ready + Verified', () => {
    it('should allow access when auth ready and MFA verified', async () => {
      // Mock authenticated session
      const mockUser = { id: 'test-user-id', email: 'test@example.com' };
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: { user: mockUser } }
      });
      
      (supabase.auth.getUser as any).mockResolvedValue({
        data: { user: mockUser }
      });

      // Mock superadmin status
      (supabase.rpc as any).mockResolvedValue({
        data: true,
        error: null,
      });

      // Mock existing MFA factor
      (supabase.auth.mfa.listFactors as any).mockResolvedValue({
        data: { totp: [{ id: 'factor-id', status: 'verified' }] },
        error: null,
      });

      // Mock valid MFA verification in localStorage
      const validUntil = Date.now() + 12 * 60 * 60 * 1000; // 12 hours from now
      localStorage.setItem('superadmin_mfa_verified', validUntil.toString());

      // Mock logging
      (supabase.functions.invoke as any).mockResolvedValue({
        data: { success: true },
        error: null,
      });

      render(
        <TestWrapper>
          <div>Test Component</div>
        </TestWrapper>
      );

      // Should show admin dashboard
      await waitFor(() => {
        expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('Route Guard - Ready + Unverified', () => {
    it('should redirect to MFA when auth ready but not verified', async () => {
      // Mock authenticated session
      const mockUser = { id: 'test-user-id', email: 'test@example.com' };
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: { user: mockUser } }
      });
      
      (supabase.auth.getUser as any).mockResolvedValue({
        data: { user: mockUser }
      });

      // Mock superadmin status
      (supabase.rpc as any).mockResolvedValue({
        data: true,
        error: null,
      });

      // Mock existing MFA factor
      (supabase.auth.mfa.listFactors as any).mockResolvedValue({
        data: { totp: [{ id: 'factor-id', status: 'verified' }] },
        error: null,
      });

      // No MFA verification in localStorage (expired or missing)
      localStorage.removeItem('superadmin_mfa_verified');

      // Mock challenge creation for MFA flow
      (supabase.auth.mfa.challenge as any).mockResolvedValue({
        data: { id: 'challenge-id' },
        error: null,
      });

      render(
        <TestWrapper>
          <div>Test Component</div>
        </TestWrapper>
      );

      // Should show MFA verification screen
      await waitFor(() => {
        expect(screen.getByText(/mfa verification required/i)).toBeInTheDocument();
      });
    });
  });

  describe('Route Guard - Not Superadmin', () => {
    it('should redirect to dashboard when user is not superadmin', async () => {
      // Mock authenticated session
      const mockUser = { id: 'test-user-id', email: 'test@example.com' };
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: { user: mockUser } }
      });
      
      (supabase.auth.getUser as any).mockResolvedValue({
        data: { user: mockUser }
      });

      // Mock NOT superadmin
      (supabase.rpc as any).mockResolvedValue({
        data: false,
        error: null,
      });

      // Mock logging
      (supabase.functions.invoke as any).mockResolvedValue({
        data: { success: true },
        error: null,
      });

      render(
        <TestWrapper>
          <div>Test Component</div>
        </TestWrapper>
      );

      // Should redirect to dashboard
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      });
    });
  });

  describe('Route Guard - No Session', () => {
    it('should redirect to auth when no session', async () => {
      // Mock no session
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: null }
      });
      
      (supabase.auth.getUser as any).mockResolvedValue({
        data: { user: null }
      });

      render(
        <TestWrapper>
          <div>Test Component</div>
        </TestWrapper>
      );

      // Should redirect to auth
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/auth');
      });
    });
  });

  describe('Route Guard - MFA Setup Required', () => {
    it('should show MFA setup when superadmin has no factors', async () => {
      // Mock authenticated session
      const mockUser = { id: 'test-user-id', email: 'test@example.com' };
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: { user: mockUser } }
      });
      
      (supabase.auth.getUser as any).mockResolvedValue({
        data: { user: mockUser }
      });

      // Mock superadmin status
      (supabase.rpc as any).mockResolvedValue({
        data: true,
        error: null,
      });

      // Mock no MFA factors (needs setup)
      (supabase.auth.mfa.listFactors as any).mockResolvedValue({
        data: { totp: [] },
        error: null,
      });

      render(
        <TestWrapper>
          <div>Test Component</div>
        </TestWrapper>
      );

      // Should show MFA setup screen
      await waitFor(() => {
        expect(screen.getByText(/multi-factor authentication setup/i)).toBeInTheDocument();
      });
    });
  });
});