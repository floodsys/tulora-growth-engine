# MFA Recovery Procedures

## Overview
This document outlines the break-glass procedures for MFA recovery without weakening normal authentication security.

## Recovery Scenarios

### 1. Lost Authenticator Device
**Symptoms**: User cannot generate TOTP codes due to lost/broken device

**Solutions** (in order of preference):
1. **Backup Codes**: Use pre-generated recovery codes (if enabled)
2. **Secondary Device**: Use backup TOTP enrollment on another device
3. **Admin Intervention**: Another superadmin removes the factor
4. **Database Direct Access**: Emergency database modification

### 2. Locked Out Superadmin
**Symptoms**: No other superadmins available, primary admin locked out

**Emergency Procedure**:
```sql
-- EMERGENCY ONLY: Remove MFA requirement for specific user
-- Execute this in Supabase SQL editor or via direct database access
DELETE FROM auth.mfa_factors 
WHERE user_id = 'USER_ID_HERE';

-- Log the emergency access in audit trail
INSERT INTO public.audit_log (
  organization_id,
  actor_user_id,
  actor_role_snapshot,
  action,
  target_type,
  target_id,
  status,
  channel,
  metadata
) VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  'USER_ID_HERE'::uuid,
  'emergency',
  'mfa.emergency_removal',
  'mfa_factor',
  'USER_ID_HERE',
  'success',
  'audit',
  jsonb_build_object(
    'emergency_access', true,
    'reason', 'Superadmin lockout recovery',
    'timestamp', now(),
    'requires_immediate_re_enrollment', true
  )
);
```

### 3. Multiple Failed Attempts
**Symptoms**: User is throttled due to too many wrong codes

**Solutions**:
1. **Wait for Cooldown**: Exponential backoff will reset (max 16 seconds)
2. **New Challenge**: Create fresh challenge if current one expired
3. **Clear Browser Storage**: Remove any corrupt local state
4. **Admin Override**: Superadmin can reset user's MFA state

## Prevention Strategies

### 1. Multiple Enrollment
- Encourage users to enroll multiple devices
- Support both smartphone and desktop authenticator apps
- Consider hardware security keys as backup

### 2. Backup Codes
```typescript
// TODO: Implement backup codes system
// Generate 10 single-use recovery codes during enrollment
// Store hashed versions in database
// Allow each code to be used once for emergency access
```

### 3. Administrative Procedures
- Maintain at least 2 active superadmins
- Document emergency contact procedures
- Regular backup of critical access credentials

## Technical Implementation

### Break-Glass Access Levels
1. **Level 1**: Standard TOTP verification
2. **Level 2**: Backup codes or secondary device
3. **Level 3**: Admin intervention via `/admin/_mfa_diag`
4. **Level 4**: Direct database access (emergency only)

### Audit Requirements
Every recovery procedure MUST:
- Log the action in `audit_log` table
- Include justification and timestamp
- Require immediate MFA re-enrollment
- Notify other superadmins

### Rate Limiting Recovery
- Emergency procedures bypass normal rate limits
- But are logged with high priority for monitoring
- Automated alerts for emergency access usage

## Post-Recovery Actions

After any recovery procedure:
1. **Immediate Re-enrollment**: User must set up new MFA factor
2. **Security Review**: Analyze what caused the lockout
3. **Process Update**: Update procedures if needed
4. **Notification**: Inform relevant stakeholders

## Monitoring and Alerts

Watch for these patterns:
- Multiple emergency access events
- Failed MFA attempts without eventual success
- Users repeatedly losing access
- Unusual geographic patterns in MFA attempts

## Contact Information

**Emergency Contacts**:
- Primary Superadmin: [CONTACT_INFO]
- Secondary Superadmin: [CONTACT_INFO]
- Database Administrator: [CONTACT_INFO]
- Security Team: [CONTACT_INFO]

**Escalation Path**:
1. Try self-service recovery options
2. Contact another superadmin
3. Contact database administrator
4. Contact security team for emergency access

---

**Important**: These procedures should only be used in genuine emergencies. Regular use indicates a problem with the MFA system that should be addressed.