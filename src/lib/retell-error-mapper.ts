// Unified error mapping and handling for Retell API responses
import { toast } from 'sonner';

export interface RetellError {
  code: string;
  message: string;
  details?: any;
  isRetryable: boolean;
  userMessage: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ApiResponse<T = any> {
  data?: T;
  error?: RetellError;
  success: boolean;
  retryAfter?: number; // seconds
}

// Known Retell error codes and their mappings
const RETELL_ERROR_MAP: Record<string, Partial<RetellError>> = {
  // Rate limiting
  '429': {
    code: 'RATE_LIMITED',
    userMessage: 'Too many requests. Please wait a moment and try again.',
    isRetryable: true,
    severity: 'warning'
  },
  
  // Authentication errors
  '401': {
    code: 'UNAUTHORIZED',
    userMessage: 'Authentication failed. Please check your API credentials.',
    isRetryable: false,
    severity: 'error'
  },
  
  // Forbidden
  '403': {
    code: 'FORBIDDEN',
    userMessage: 'Access denied. You may not have permission for this action.',
    isRetryable: false,
    severity: 'error'
  },
  
  // Not found
  '404': {
    code: 'NOT_FOUND',
    userMessage: 'The requested resource was not found.',
    isRetryable: false,
    severity: 'error'
  },
  
  // Validation errors
  '400': {
    code: 'VALIDATION_ERROR',
    userMessage: 'Invalid request data. Please check your input and try again.',
    isRetryable: false,
    severity: 'error'
  },
  
  // Server errors
  '500': {
    code: 'INTERNAL_ERROR',
    userMessage: 'Internal server error. Please try again in a few moments.',
    isRetryable: true,
    severity: 'error'
  },
  
  '502': {
    code: 'BAD_GATEWAY',
    userMessage: 'Service temporarily unavailable. Please try again.',
    isRetryable: true,
    severity: 'error'
  },
  
  '503': {
    code: 'SERVICE_UNAVAILABLE',
    userMessage: 'Service is temporarily down for maintenance.',
    isRetryable: true,
    severity: 'warning'
  },
  
  '504': {
    code: 'TIMEOUT',
    userMessage: 'Request timed out. Please try again.',
    isRetryable: true,
    severity: 'warning'
  },
  
  // Network errors
  'NETWORK_ERROR': {
    code: 'NETWORK_ERROR',
    userMessage: 'Network connection error. Please check your internet connection.',
    isRetryable: true,
    severity: 'error'
  },
  
  // Quota exceeded
  'QUOTA_EXCEEDED': {
    code: 'QUOTA_EXCEEDED',
    userMessage: 'Usage quota exceeded. Please upgrade your plan or try again later.',
    isRetryable: false,
    severity: 'error'
  },
  
  // Agent specific errors
  'AGENT_NOT_FOUND': {
    code: 'AGENT_NOT_FOUND',
    userMessage: 'Voice agent not found. It may have been deleted or moved.',
    isRetryable: false,
    severity: 'error'
  },
  
  'AGENT_BUSY': {
    code: 'AGENT_BUSY',
    userMessage: 'Agent is currently busy with another call. Please try again.',
    isRetryable: true,
    severity: 'warning'
  },
  
  // Call specific errors
  'CALL_FAILED': {
    code: 'CALL_FAILED',
    userMessage: 'Call could not be established. Please check the phone number and try again.',
    isRetryable: true,
    severity: 'error'
  },
  
  'CALL_REJECTED': {
    code: 'CALL_REJECTED',
    userMessage: 'Call was rejected by the recipient or carrier.',
    isRetryable: false,
    severity: 'info'
  },
  
  'INVALID_PHONE': {
    code: 'INVALID_PHONE',
    userMessage: 'Invalid phone number format. Please check and try again.',
    isRetryable: false,
    severity: 'error'
  },
  
  // Knowledge base errors
  'KB_NOT_FOUND': {
    code: 'KB_NOT_FOUND',
    userMessage: 'Knowledge base not found or has been deleted.',
    isRetryable: false,
    severity: 'error'
  },
  
  'KB_PROCESSING': {
    code: 'KB_PROCESSING',
    userMessage: 'Knowledge base is still being processed. Please wait and try again.',
    isRetryable: true,
    severity: 'info'
  },
  
  // Generic fallback
  'UNKNOWN_ERROR': {
    code: 'UNKNOWN_ERROR',
    userMessage: 'An unexpected error occurred. Please try again or contact support.',
    isRetryable: true,
    severity: 'error'
  }
};

export class RetellErrorMapper {
  /**
   * Map a raw error response to a structured RetellError
   */
  static mapError(error: any): RetellError {
    console.error('Retell API Error:', error);
    
    let mappedError: RetellError;
    
    // Handle HTTP status codes
    if (error.status || error.code) {
      const statusCode = error.status?.toString() || error.code?.toString();
      const errorMapping = RETELL_ERROR_MAP[statusCode];
      
      if (errorMapping) {
        mappedError = {
          message: error.message || error.detail || 'An error occurred',
          details: error,
          ...errorMapping
        } as RetellError;
      } else {
        mappedError = {
          code: 'UNKNOWN_ERROR',
          message: error.message || 'Unknown error occurred',
          userMessage: 'An unexpected error occurred. Please try again.',
          isRetryable: true,
          severity: 'error',
          details: error
        };
      }
    }
    // Handle network errors
    else if (error.name === 'NetworkError' || error.code === 'NETWORK_ERROR') {
      mappedError = {
        ...RETELL_ERROR_MAP.NETWORK_ERROR,
        message: error.message || 'Network error',
        details: error
      } as RetellError;
    }
    // Handle specific Retell error codes
    else if (error.error_code && RETELL_ERROR_MAP[error.error_code]) {
      mappedError = {
        ...RETELL_ERROR_MAP[error.error_code],
        message: error.message || error.detail || 'Retell API error',
        details: error
      } as RetellError;
    }
    // Generic fallback
    else {
      mappedError = {
        ...RETELL_ERROR_MAP.UNKNOWN_ERROR,
        message: error.message || 'Unknown error',
        details: error
      } as RetellError;
    }
    
    return mappedError;
  }

  /**
   * Handle an error by showing appropriate user feedback
   */
  static handleError(error: any, context?: string): RetellError {
    const mappedError = this.mapError(error);
    
    // Log error for debugging
    console.error(`Retell Error [${context || 'Unknown'}]:`, {
      code: mappedError.code,
      message: mappedError.message,
      userMessage: mappedError.userMessage,
      isRetryable: mappedError.isRetryable,
      details: mappedError.details
    });
    
    // Show user-friendly toast based on severity
    const toastOptions = {
      duration: mappedError.severity === 'error' ? 8000 : 5000,
      action: mappedError.isRetryable ? {
        label: 'Retry',
        onClick: () => {
          // Retry functionality would be handled by the calling component
          console.log('Retry requested for error:', mappedError.code);
        }
      } : undefined
    };
    
    switch (mappedError.severity) {
      case 'error':
        toast.error(mappedError.userMessage, toastOptions);
        break;
      case 'warning':
        toast.warning(mappedError.userMessage, toastOptions);
        break;
      case 'info':
        toast.info(mappedError.userMessage, toastOptions);
        break;
    }
    
    return mappedError;
  }

  /**
   * Wrap API calls with unified error handling
   */
  static async wrapApiCall<T>(
    apiCall: () => Promise<T>,
    context?: string
  ): Promise<ApiResponse<T>> {
    try {
      const data = await apiCall();
      return {
        data,
        success: true
      };
    } catch (error: any) {
      const mappedError = this.handleError(error, context);
      
      // Extract retry-after header for rate limiting
      let retryAfter: number | undefined;
      if (error.headers?.['retry-after']) {
        retryAfter = parseInt(error.headers['retry-after'], 10);
      } else if (mappedError.code === 'RATE_LIMITED') {
        retryAfter = 60; // Default 1 minute for rate limits
      }
      
      return {
        error: mappedError,
        success: false,
        retryAfter
      };
    }
  }

  /**
   * Check if an error should trigger an automatic retry
   */
  static shouldRetry(error: RetellError, attemptCount: number = 0): boolean {
    if (!error.isRetryable) return false;
    if (attemptCount >= 3) return false; // Max 3 retries
    
    // Don't retry rate limits immediately
    if (error.code === 'RATE_LIMITED') return false;
    
    return true;
  }

  /**
   * Calculate backoff delay for retries
   */
  static getRetryDelay(attemptCount: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s...
    return Math.min(1000 * Math.pow(2, attemptCount), 30000);
  }
}

// Export utility functions for common use cases
export const mapRetellError = RetellErrorMapper.mapError;
export const handleRetellError = RetellErrorMapper.handleError;
export const wrapRetellApiCall = RetellErrorMapper.wrapApiCall;