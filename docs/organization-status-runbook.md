# Organization Status Management Runbook

## Overview

This document outlines the standardized approach for handling organization status changes, error codes, and user-facing messaging across the platform.

## Status Types

### Active
- **Database Value**: `suspension_status = 'active'`
- **Behavior**: Full platform access
- **UI Display**: Green badge "Active"

### Suspended  
- **Database Value**: `suspension_status = 'suspended'`
- **HTTP Status**: `423 Locked`
- **Error Code**: `ORG_SUSPENDED`
- **Behavior**: Limited access (billing + read-only settings)
- **UI Display**: Yellow badge "Suspended"

### Canceled
- **Database Value**: `suspension_status = 'canceled'`  
- **HTTP Status**: `410 Gone`
- **Error Code**: `ORG_CANCELED`
- **Behavior**: Minimal access (billing portal only)
- **UI Display**: Red badge "Canceled"

## Blocked Operations by Status

### Suspended Organizations (`ORG_SUSPENDED`)

**Blocked:**
- Agent operations (calls, API access)
- Webhook dispatching  
- New member invitations
- Data operations (CRUD on operational tables)
- File uploads and processing
- Usage tracking

**Allowed:**
- Billing portal access
- Settings (read-only)
- Support contacts
- Authentication flows
- Account management

### Canceled Organizations (`ORG_CANCELED`)

**Blocked:**
- All operational services
- Data operations
- Agent access
- API access
- Member management

**Allowed:**
- Billing portal (limited)
- Final account access
- Support contacts

## Error Response Format

### API Responses

```json
{
  "error": "Your organization's service has been temporarily suspended. Please contact your organization owner or admin for assistance.",
  "code": "ORG_SUSPENDED",
  "status": 423,
  "title": "Service Temporarily Suspended", 
  "support": "Contact your organization admin for assistance",
  "organizationId": "uuid",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

### HTTP Status Codes

- **423 Locked**: Organization suspended
- **410 Gone**: Organization canceled  
- **404 Not Found**: Organization not found
- **403 Forbidden**: Access denied (other reasons)

## User-Facing Messages

### Suspended (`ORG_SUSPENDED`)

**Primary Message**: "Your organization's service has been temporarily suspended. Please contact your organization owner or admin for assistance."

**Short Form**: "Service is temporarily suspended"

**Admin View**: "Organization service is suspended"

### Canceled (`ORG_CANCELED`)

**Primary Message**: "Your organization's service has been canceled. Please contact support for assistance."

**Short Form**: "Service has been canceled"

**Admin View**: "Organization service is canceled"

## Implementation Locations

### Backend Guard System
- **File**: `supabase/functions/_shared/org-guard.ts`
- **Function**: `requireOrgActive()`
- **Response**: `createBlockedResponse()`

### Error Codes Library
- **File**: `src/lib/error-codes.ts`
- **Constants**: `ORG_STATUS_ERRORS`
- **Functions**: `getOrgStatusError()`, `createOrgStatusErrorResponse()`

### UI Components
- **Modal**: `src/components/ui/ServiceBlockedModal.tsx`
- **Banner**: `src/components/ui/SuspensionBanner.tsx` 
- **Admin**: `src/components/admin/OrganizationsDirectory.tsx`

### Database Functions
- **Suspend**: `suspend_organization()`
- **Cancel**: `cancel_organization()`
- **Reinstate**: `reinstate_organization()`

## Testing

### Guard Tests
```bash
# Test suspension blocking
POST /guard-tests
{
  "organizationId": "uuid",
  "testType": "guard", 
  "scenario": "suspended",
  "operation": "agent_operations"
}

# Expected: HTTP 423, ORG_SUSPENDED
```

### UI Tests
- Verify modal displays correct error code
- Confirm badge colors match status
- Test support links are functional

## Monitoring & Alerts

### Alert Rules
- **Blocked Operations**: >10 in 5 minutes triggers alert
- **Status Changes**: All suspend/cancel/reinstate actions logged
- **Error Rates**: Monitor 423/410 response rates

### Audit Logging
```json
{
  "action": "org.blocked_operation",
  "status": "blocked", 
  "metadata": {
    "blocked_action": "agent.start",
    "block_reason": "ORG_SUSPENDED",
    "organization_name": "Acme Corp"
  }
}
```

## Admin Actions

### Suspension Process
1. Admin selects "Suspend Service"
2. Provides reason and confirms with typed phrase
3. System updates `suspension_status = 'suspended'`
4. All new requests return HTTP 423
5. Audit log entry created

### Cancellation Process  
1. Admin selects "Cancel Service" (red warning)
2. Provides reason and confirms with typed phrase
3. System updates `suspension_status = 'canceled'`
4. All requests return HTTP 410 (except billing)
5. Audit log entry created

### Reinstatement Process
1. Admin selects "Reinstate Service"
2. Provides reason and confirms
3. System updates `suspension_status = 'active'`  
4. Normal operations resume
5. Audit log entry created

## Troubleshooting

### Common Issues

**Wrong HTTP Status**
- Check `createBlockedResponse()` in org-guard.ts
- Verify error code mapping

**Inconsistent Messages**
- Update `ORG_STATUS_ERRORS` in error-codes.ts
- Check UI components use `getOrgStatusError()`

**Cache Issues**  
- Guard system is stateless (no caching)
- Database queries are real-time
- Check RLS policies if access seems wrong

**Testing Guards**
- Use `/admin/guard-tests` for verification
- Check both API and RLS enforcement
- Verify audit logging

## Emergency Procedures

### Mass Suspension
```sql
UPDATE organizations 
SET suspension_status = 'suspended',
    suspension_reason = 'Emergency maintenance',
    suspended_at = now()
WHERE id IN ('uuid1', 'uuid2', ...);
```

### Emergency Reinstatement
```sql
UPDATE organizations
SET suspension_status = 'active',
    suspension_reason = NULL,
    suspended_at = NULL  
WHERE suspension_status IN ('suspended', 'canceled');
```

### Rate Limiting Override
- Blocked operation tracking prevents log spam
- Max 50 blocked operations per minute per org/IP
- Cache clears automatically after 1 minute window

## Contact Information

- **Platform Team**: platform@company.com
- **Support Team**: support@company.com  
- **Emergency**: emergency@company.com

---

*Last Updated: 2025-01-24*
*Version: 1.0*