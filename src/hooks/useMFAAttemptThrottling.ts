import { useState, useCallback } from 'react';

interface AttemptThrottling {
  canAttempt: boolean;
  attemptsLeft: number;
  cooldownTime: number;
  recordFailedAttempt: () => void;
  reset: () => void;
}

export function useMFAAttemptThrottling(maxAttempts = 5, baseCooldown = 1000): AttemptThrottling {
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lastAttemptTime, setLastAttemptTime] = useState(0);

  const getCooldownTime = useCallback((attempts: number): number => {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    return baseCooldown * Math.pow(2, Math.min(attempts - 1, 4));
  }, [baseCooldown]);

  const canAttempt = useCallback((): boolean => {
    if (failedAttempts === 0) return true;
    
    const now = Date.now();
    const requiredCooldown = getCooldownTime(failedAttempts);
    return (now - lastAttemptTime) >= requiredCooldown;
  }, [failedAttempts, lastAttemptTime, getCooldownTime]);

  const recordFailedAttempt = useCallback(() => {
    setFailedAttempts(prev => prev + 1);
    setLastAttemptTime(Date.now());
  }, []);

  const reset = useCallback(() => {
    setFailedAttempts(0);
    setLastAttemptTime(0);
  }, []);

  const attemptsLeft = Math.max(0, maxAttempts - failedAttempts);
  const cooldownTime = failedAttempts > 0 ? getCooldownTime(failedAttempts) : 0;

  return {
    canAttempt: canAttempt(),
    attemptsLeft,
    cooldownTime,
    recordFailedAttempt,
    reset
  };
}