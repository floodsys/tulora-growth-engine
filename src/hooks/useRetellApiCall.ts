import { useState, useCallback } from 'react';
import { RetellErrorMapper, ApiResponse } from '@/lib/retell-error-mapper';

interface RetryableOperation<T> {
  execute: () => Promise<T>;
  context?: string;
  maxRetries?: number;
  backoffMultiplier?: number;
}

export const useRetellApiCall = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  const executeWithRetry = useCallback(async <T>(
    operation: RetryableOperation<T>
  ): Promise<ApiResponse<T>> => {
    const { 
      execute, 
      context, 
      maxRetries = 3, 
      backoffMultiplier = 1 
    } = operation;
    
    setLoading(true);
    setError(null);
    
    let attemptCount = 0;
    
    while (attemptCount <= maxRetries) {
      try {
        const result = await RetellErrorMapper.wrapApiCall(execute, context);
        
        if (result.success) {
          setLoading(false);
          return result;
        }
        
        // If not retryable or max attempts reached, return error
        if (!RetellErrorMapper.shouldRetry(result.error!, attemptCount) || 
            attemptCount >= maxRetries) {
          setError(result.error);
          setLoading(false);
          return result;
        }
        
        // Wait before retry
        const delay = RetellErrorMapper.getRetryDelay(attemptCount) * backoffMultiplier;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        attemptCount++;
        
      } catch (error: any) {
        const mappedError = RetellErrorMapper.handleError(error, context);
        
        if (!RetellErrorMapper.shouldRetry(mappedError, attemptCount) || 
            attemptCount >= maxRetries) {
          setError(mappedError);
          setLoading(false);
          return { error: mappedError, success: false };
        }
        
        const delay = RetellErrorMapper.getRetryDelay(attemptCount) * backoffMultiplier;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        attemptCount++;
      }
    }
    
    // Should never reach here, but just in case
    const fallbackError = RetellErrorMapper.mapError(new Error('Max retries exceeded'));
    setError(fallbackError);
    setLoading(false);
    return { error: fallbackError, success: false };
  }, []);

  const callApi = useCallback(async <T>(
    apiCall: () => Promise<T>,
    context?: string
  ): Promise<ApiResponse<T>> => {
    return executeWithRetry({
      execute: apiCall,
      context
    });
  }, [executeWithRetry]);

  return {
    callApi,
    executeWithRetry,
    loading,
    error,
    setError
  };
};