# Security Documentation

## Superadmin Authorization Policy

### Source of Truth: Database RPC Only

**CRITICAL SECURITY PRINCIPLE:** All superadmin authorization must use the database RPC function `public.is_superadmin()` as the single source of truth.

#### Authorization Flow
1. **Primary Check:** `supabase.rpc('is_superadmin')` queries the `public.superadmins` table
2. **Fallback:** GUC (Grand Unified Configuration) setting for bootstrapping only
3. **Environment Variables:** COSMETIC ONLY - never used for authorization decisions

#### Prohibited Authorization Methods
❌ **NEVER USE:**
- Direct email string comparisons (`email === 'admin@domain.com'`)
- Environment variable checks for authorization (`process.env.SUPERADMINS_EMAILS`)
- Client-side only authorization
- Hardcoded user lists

✅ **ALWAYS USE:**
- `supabase.rpc('is_superadmin')` for all authorization decisions
- Database policies with RLS enabled
- Standardized error messages
- Proper audit logging

### Environment Variables (Cosmetic Only)

These environment variables are for UI hints, logging, and development convenience ONLY:

- `VITE_SUPERADMINS_EMAILS` - Frontend UI hints
- `SUPERADMINS_EMAILS` - Backend logging/debugging  
- `superadmins_emails` - Alternative backend setting

**WARNING:** These variables must NEVER be used for authorization decisions.

### Security Verification Procedures

#### Manual Testing
1. Sign in as superadmin → Verify admin access granted
2. Sign in as non-superadmin → Verify admin access denied (403)
3. Test all admin endpoints with both user types
4. Verify diagnostic page is restricted

#### Automated Testing
```bash
# Run security test suite
npm test

# Run superadmin authorization tests
npm run test:auth

# Check for environment-based authorization (should find none)
grep -r "SUPERADMINS_EMAILS.*auth\|email.*===.*admin" src/
```

#### CI/CD Pipeline
- Unit tests verify DB RPC usage
- Integration tests check edge functions
- Security scans prevent env-based auth
- Linting enforces policy compliance

### Admin Diagnostic Page Security

The diagnostic page (`/admin/_diag`) contains sensitive system information and is strictly controlled:

#### Access Control
- **Route Protection:** Secured by `useAdminAccess()` hook
- **Superadmin Only:** Must pass `supabase.rpc('is_superadmin')` check
- **Production Lockdown:** API probes disabled in production by default
- **Feature Flags:** Can be overridden by superadmins if needed

#### Re-enabling Diagnostic Features

For future debugging, superadmins can:

1. **Enable API Probes in Production:**
   - Navigate to `/admin/_diag`
   - Click "Show API Probes" button (superadmin only)
   - Use responsibly and disable when finished

2. **Development Access:**
   - All diagnostic features available in `NODE_ENV=development`
   - No restrictions for local development

#### Security Monitoring
- All diagnostic access is logged
- Failed access attempts are tracked
- Audit trail maintained for compliance

### Incident Response

If unauthorized access is suspected:

1. **Immediate Actions:**
   - Check audit logs for unauthorized attempts
   - Verify superadmin table integrity
   - Review recent user additions

2. **Investigation:**
   - Run security test suite: `npm test`
   - Check for environment-based auth leaks
   - Verify RLS policies are enabled

3. **Remediation:**
   - Remove unauthorized superadmins
   - Update affected credentials
   - Review and tighten policies

### Compliance Notes

- All authorization decisions are auditable
- Security policy is documented and tested
- Environment variables are clearly marked as cosmetic
- Regular security reviews are conducted

---

**Last Updated:** 2025-01-25
**Policy Version:** 2.0
**Next Review:** Quarterly