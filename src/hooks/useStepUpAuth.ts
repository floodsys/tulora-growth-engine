import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useRateLimitHandler } from '@/hooks/useRateLimitHandler';

interface StepUpSession {
  success: boolean;
  session_token?: string;
  expires_at?: string;
  verification_method?: 'mfa' | 'password';
  error?: string;
  error_code?: string;
}

export function useStepUpAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const [hasValidSession, setHasValidSession] = useState(false);
  const { toast } = useToast();
  const { handleRateLimitedResponse } = useRateLimitHandler();

  const verifyMFA = useCallback(async (code: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      // First verify MFA with Supabase Auth
      const { data: factors } = await supabase.auth.mfa.listFactors();
      if (!factors?.totp || factors.totp.length === 0) {
        throw new Error('MFA not set up');
      }

      const factor = factors.totp[0];
      const { data: challenge } = await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (!challenge) {
        throw new Error('Failed to create MFA challenge');
      }

      const { data: verification, error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challenge.id,
        code
      });

      if (verifyError || !verification) {
        throw new Error('Invalid MFA code');
      }

      // If MFA verification succeeds, create step-up session
      const { data, error } = await supabase.rpc('verify_step_up_auth', {
        p_mfa_code: code
      });

      if (error) throw error;

      const result = data as unknown as StepUpSession;
      if (result.success) {
        setHasValidSession(true);
        toast({
          title: 'Authentication Verified',
          description: 'Step-up authentication successful with MFA'
        });
        return true;
      } else if (handleRateLimitedResponse(result as any)) {
        return false; // Rate limited
      } else {
        throw new Error(result.error || 'Failed to create step-up session');
      }
    } catch (err) {
      console.error('MFA verification failed:', err);
      toast({
        title: 'Verification Failed',
        description: err instanceof Error ? err.message : 'Invalid MFA code',
        variant: 'destructive'
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const verifyPassword = useCallback(async (password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      // Verify password by attempting to sign in (this validates the password)
      const { data: user } = await supabase.auth.getUser();
      if (!user.user?.email) {
        throw new Error('User email not found');
      }

      // Use Supabase auth to verify password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.user.email,
        password
      });

      if (signInError) {
        throw new Error('Invalid password');
      }

      // If password verification succeeds, create step-up session
      const { data, error } = await supabase.rpc('verify_step_up_auth', {
        p_password: password
      });

      if (error) throw error;

      const result = data as unknown as StepUpSession;
      if (result.success) {
        setHasValidSession(true);
        toast({
          title: 'Authentication Verified',
          description: 'Step-up authentication successful with password'
        });
        return true;
      } else if (handleRateLimitedResponse(result as any)) {
        return false; // Rate limited
      } else {
        throw new Error(result.error || 'Failed to create step-up session');
      }
    } catch (err) {
      console.error('Password verification failed:', err);
      toast({
        title: 'Verification Failed',
        description: err instanceof Error ? err.message : 'Invalid password',
        variant: 'destructive'
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const checkStepUpAuth = useCallback(async (action?: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('check_step_up_auth', {
        p_action: action
      });
      
      if (error) throw error;
      
      const isValid = Boolean(data);
      setHasValidSession(isValid);
      return isValid;
    } catch (err) {
      console.error('Failed to check step-up auth:', err);
      setHasValidSession(false);
      return false;
    }
  }, []);

  const requireStepUpAuth = useCallback(async (action: string) => {
    try {
      const { data, error } = await supabase.rpc('require_step_up_auth', {
        p_action: action
      });
      
      if (error) throw error;
      
      return data;
    } catch (err) {
      console.error('Step-up auth check failed:', err);
      return {
        success: false,
        error: 'Failed to verify step-up authentication',
        error_code: 'verification_failed'
      };
    }
  }, []);

  return {
    isLoading,
    hasValidSession,
    verifyMFA,
    verifyPassword,
    checkStepUpAuth,
    requireStepUpAuth
  };
}