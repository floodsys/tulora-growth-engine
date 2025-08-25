# Security Policy

## Superadmin Authorization

### **Source of Truth: Database RPC Only**

**CRITICAL:** All superadmin authorization decisions MUST use the database RPC `public.is_superadmin(auth.uid())` as the single source of truth.

**Environment variables are COSMETIC ONLY and NEVER used for authorization.**

### Authorization Flow

1. **Primary Check**: `public.is_superadmin(auth.uid())` queries the `public.superadmins` table
2. **Fallback**: If no record exists, the function checks GUC settings (`app.superadmin_emails`, `app.superadmins_emails`)
3. **Client Routes**: All `/admin` routes use `supabase.rpc('is_superadmin')` via hooks
4. **Edge Functions**: All admin edge functions verify via `supabaseClient.rpc('is_superadmin')` with caller's JWT

### Environment Variables (Cosmetic Only)

These environment variables are for UI hints and logging purposes **ONLY**:

- `VITE_SUPERADMINS_EMAILS` (Frontend) - Client-side UI hints
- `SUPERADMINS_EMAILS` (Server/Edge) - Server-side logging/hints  
- `superadmins_emails` (Server/Edge) - Alternative server-side name

**⚠️ WARNING:** Never use these environment variables for authorization decisions. They are purely cosmetic.

### Verification Commands

To verify a user's superadmin status:

```sql
-- Check DB table
SELECT * FROM public.superadmins WHERE user_id = 'user-uuid-here';

-- Check RPC function (authoritative)
SELECT public.is_superadmin('user-uuid-here');

-- Check GUC fallback
SELECT current_setting('app.superadmin_emails', true);
```

### Adding Superadmins

1. **Via Database**: Direct insert into `public.superadmins` table
2. **Via RPC**: Use `public.add_superadmin('email@domain.com')` function
3. **Bootstrap**: Use `/admin/setup` with bootstrap token (development only)

### Admin Routes Security

- **Client Guards**: `useAdminAccess()` and `useSuperadmin()` hooks
- **Edge Functions**: Each admin function verifies `is_superadmin()` before processing
- **Error Messages**: Standardized "Superadmin privileges required. Access denied by database authorization."

### Cache Busting

Use `/admin/_diag` "Hard Refresh Cache" to clear:
- Service workers
- Browser caches  
- Local/session storage
- Force reload with fresh code

This prevents stale authorization guards from old deployments.

### Compliance

- All admin access attempts are logged via `log_unauthorized_access()`
- Diagnostic page shows current BUILD_ID and authorization chain
- Environment variables are clearly marked as cosmetic-only

## Security Principle

**Source of truth = DB (public.superadmins + GUC fallback inside is_superadmin). Env checks are cosmetic only.**

Any authorization logic that bypasses this principle is a security vulnerability and must be fixed immediately.