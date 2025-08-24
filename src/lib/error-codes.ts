/**
 * Standardized error codes and messages for organization status handling
 * 
 * This file centralizes all error codes, HTTP status codes, and user-facing messages
 * for consistent handling across the application.
 */

export const ORG_STATUS_ERRORS = {
  ORG_SUSPENDED: {
    code: 'ORG_SUSPENDED',
    status: 423, // HTTP 423 Locked
    title: 'Service Temporarily Suspended',
    message: 'Your organization\'s service has been temporarily suspended. Please contact your organization owner or admin for assistance.',
    userMessage: 'Service is temporarily suspended',
    adminMessage: 'Organization service is suspended',
    support: 'Contact your organization admin for assistance'
  },
  ORG_CANCELED: {
    code: 'ORG_CANCELED', 
    status: 410, // HTTP 410 Gone
    title: 'Service Canceled',
    message: 'Your organization\'s service has been canceled. Please contact support for assistance.',
    userMessage: 'Service has been canceled',
    adminMessage: 'Organization service is canceled',
    support: 'Contact support for assistance'
  },
  ORG_NOT_FOUND: {
    code: 'ORG_NOT_FOUND',
    status: 404,
    title: 'Organization Not Found',
    message: 'The requested organization could not be found.',
    userMessage: 'Organization not found',
    adminMessage: 'Organization not found',
    support: 'Contact support if you believe this is an error'
  }
} as const;

export type OrgStatusErrorCode = keyof typeof ORG_STATUS_ERRORS;

/**
 * Gets error details by code
 */
export function getOrgStatusError(code: OrgStatusErrorCode) {
  return ORG_STATUS_ERRORS[code];
}

/**
 * Checks if an error code represents a blocked organization
 */
export function isOrgBlocked(code: string): boolean {
  return code === 'ORG_SUSPENDED' || code === 'ORG_CANCELED';
}

/**
 * Gets user-friendly message for organization status
 */
export function getOrgStatusMessage(suspensionStatus: string, context: 'user' | 'admin' = 'user'): string {
  switch (suspensionStatus) {
    case 'suspended':
      return context === 'admin' 
        ? ORG_STATUS_ERRORS.ORG_SUSPENDED.adminMessage
        : ORG_STATUS_ERRORS.ORG_SUSPENDED.userMessage;
    case 'canceled':
      return context === 'admin'
        ? ORG_STATUS_ERRORS.ORG_CANCELED.adminMessage  
        : ORG_STATUS_ERRORS.ORG_CANCELED.userMessage;
    case 'active':
      return 'Service is active';
    default:
      return 'Unknown status';
  }
}

/**
 * Creates standardized API error response
 */
export function createOrgStatusErrorResponse(code: OrgStatusErrorCode, organizationId?: string) {
  const error = getOrgStatusError(code);
  return {
    error: error.message,
    code: error.code,
    status: error.status,
    title: error.title,
    support: error.support,
    organizationId,
    timestamp: new Date().toISOString()
  };
}