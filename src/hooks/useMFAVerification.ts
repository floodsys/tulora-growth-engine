import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MFAStatus {
  isEnrolled: boolean;
  isVerified: boolean;
  needsSetup: boolean;
  needsVerification: boolean;
  isLoading: boolean;
}

export function useMFAVerification(isSuperadmin: boolean) {
  const [mfaStatus, setMfaStatus] = useState<MFAStatus>({
    isEnrolled: false,
    isVerified: false,
    needsSetup: false,
    needsVerification: false,
    isLoading: true
  });

  useEffect(() => {
    if (!isSuperadmin) {
      setMfaStatus({
        isEnrolled: true,
        isVerified: true,
        needsSetup: false,
        needsVerification: false,
        isLoading: false
      });
      return;
    }

    checkMFAStatus();
  }, [isSuperadmin]);

  const checkMFAStatus = async () => {
    try {
      // Check if user has enrolled MFA factors
      const { data: factors, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;

      const isEnrolled = factors.totp && factors.totp.length > 0;

      if (!isEnrolled) {
        setMfaStatus({
          isEnrolled: false,
          isVerified: false,
          needsSetup: true,
          needsVerification: false,
          isLoading: false
        });
        return;
      }

      // Check if MFA verification is still valid (12 hours)
      const mfaVerifiedUntil = localStorage.getItem('superadmin_mfa_verified');
      const isVerified = mfaVerifiedUntil && parseInt(mfaVerifiedUntil) > Date.now();

      setMfaStatus({
        isEnrolled: true,
        isVerified: Boolean(isVerified),
        needsSetup: false,
        needsVerification: !isVerified,
        isLoading: false
      });
    } catch (error) {
      console.error('Error checking MFA status:', error);
      setMfaStatus({
        isEnrolled: false,
        isVerified: false,
        needsSetup: true,
        needsVerification: false,
        isLoading: false
      });
    }
  };

  const refreshMFAStatus = () => {
    setMfaStatus(prev => ({ ...prev, isLoading: true }));
    checkMFAStatus();
  };

  const markAsVerified = () => {
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).getTime();
    localStorage.setItem('superadmin_mfa_verified', expiresAt.toString());
    setMfaStatus(prev => ({
      ...prev,
      isVerified: true,
      needsVerification: false
    }));
  };

  const clearVerification = () => {
    localStorage.removeItem('superadmin_mfa_verified');
    setMfaStatus(prev => ({
      ...prev,
      isVerified: false,
      needsVerification: prev.isEnrolled
    }));
  };

  return {
    ...mfaStatus,
    refreshMFAStatus,
    markAsVerified,
    clearVerification
  };
}