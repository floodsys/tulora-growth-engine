/**
 * Organization Role Authorization Guard
 *
 * Resolves the caller's membership in a target org and requires
 * that their role is in the supplied allowlist.  Returns a
 * fail-closed result: any error → denied.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

export interface OrgRoleGuardResult {
    ok: boolean;
    status?: number;
    reason?: string;
    callerRole?: string;
}

/**
 * Checks whether `userId` holds one of `allowedRoles` in the given org.
 *
 * Fail-closed: if the lookup errors, or the user has no membership,
 * or the role is not in the allowlist, the result is `{ ok: false }`.
 */
export async function requireOrgRole(
    supabase: SupabaseClient,
    organizationId: string,
    userId: string,
    allowedRoles: string[],
): Promise<OrgRoleGuardResult> {
    try {
        // Validate inputs
        if (!organizationId || !userId) {
            return { ok: false, status: 400, reason: 'missing_parameters' };
        }

        const { data: membership, error } = await supabase
            .from('organization_members')
            .select('role')
            .eq('organization_id', organizationId)
            .eq('user_id', userId)
            .single();

        if (error || !membership) {
            return {
                ok: false,
                status: 403,
                reason: 'not_org_member',
            };
        }

        if (!allowedRoles.includes(membership.role)) {
            return {
                ok: false,
                status: 403,
                reason: 'insufficient_role',
                callerRole: membership.role,
            };
        }

        return { ok: true, callerRole: membership.role };
    } catch (_err) {
        // Fail closed on unexpected errors
        return { ok: false, status: 500, reason: 'internal_error' };
    }
}

/**
 * Checks whether removing the given user (who is an owner) would
 * leave the organization with zero owners.
 *
 * Returns `true` if the user is the **last** owner and the operation
 * should therefore be blocked.
 */
export async function isLastOwner(
    supabase: SupabaseClient,
    organizationId: string,
    userId: string,
): Promise<boolean> {
    try {
        const { count, error } = await supabase
            .from('organization_members')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', organizationId)
            .eq('role', 'owner');

        if (error) {
            // Fail closed: assume last owner to prevent accidental lockout
            return true;
        }

        // If exactly 1 owner remains, check if it's the target user
        if ((count ?? 0) <= 1) {
            const { data: member } = await supabase
                .from('organization_members')
                .select('user_id')
                .eq('organization_id', organizationId)
                .eq('role', 'owner')
                .single();

            return member?.user_id === userId;
        }

        return false;
    } catch (_err) {
        // Fail closed
        return true;
    }
}
