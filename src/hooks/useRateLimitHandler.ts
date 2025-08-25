import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

interface RateLimitInfo {
  allowed: boolean;
  reason?: string;
  current_count?: number;
  limit?: number;
  remaining?: number;
  blocked_until?: string;
  backoff_level?: number;
  retry_after_seconds?: number;
}

interface RateLimitResponse {
  success: boolean;
  error?: string;
  error_code?: string;
  rate_limit_info?: RateLimitInfo;
}

export function useRateLimitHandler() {
  const { toast } = useToast();

  const handleRateLimitedResponse = (response: RateLimitResponse): boolean => {
    if (response.error_code === 'rate_limited' && response.rate_limit_info) {
      const info = response.rate_limit_info;
      
      let title = 'Rate Limit Exceeded';
      let description = '';
      let variant: 'default' | 'destructive' = 'destructive';

      switch (info.reason) {
        case 'minute_limit_exceeded':
          description = `Too many requests (${info.current_count}/${info.limit} per minute). `;
          break;
        case 'hourly_limit_exceeded':
          description = `Hourly limit exceeded (${info.current_count}/${info.limit} per hour). `;
          break;
        case 'exponential_backoff':
          description = `Currently blocked due to repeated violations (Level ${info.backoff_level}). `;
          break;
        default:
          description = 'Request rate limit exceeded. ';
      }

      if (info.retry_after_seconds) {
        const minutes = Math.ceil(info.retry_after_seconds / 60);
        description += `Please try again in ${info.retry_after_seconds < 60 ? info.retry_after_seconds + ' seconds' : minutes + ' minutes'}.`;
      }

      toast({
        title,
        description,
        variant,
        duration: 10000 // Show longer for rate limit messages
      });

      return true; // Indicates rate limited
    }
    
    return false; // Not rate limited
  };

  const getRateLimitStatus = (info?: RateLimitInfo) => {
    if (!info || !info.allowed) return null;
    
    return {
      current: info.current_count || 0,
      limit: info.limit || 0,
      remaining: info.remaining || 0,
      percentUsed: info.limit ? ((info.current_count || 0) / info.limit) * 100 : 0
    };
  };

  return {
    handleRateLimitedResponse,
    getRateLimitStatus
  };
}