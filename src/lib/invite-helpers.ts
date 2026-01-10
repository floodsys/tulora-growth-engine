import { supabase } from "@/integrations/supabase/client";

export interface CreateInviteParams {
  p_org: string;
  p_email: string;
  p_role: string;
}

export interface CreateInviteResponse {
  success: boolean;
  invitation_id?: string;
  token?: string;
  expires_at?: string;
  organization_id?: string;
  email?: string;
  role?: string;
  error?: string;
  error_code?: string;
}

export interface AcceptInviteResponse {
  success: boolean;
  organization_id?: string;
  organization_name?: string;
  role?: string;
  message?: string;
  error?: string;
  error_code?: string;
}

/**
 * Create an organization invite using the database RPC function.
 * This is still the preferred method for creating invites as it handles
 * permission checks and token generation server-side.
 */
export async function createInvite(params: CreateInviteParams): Promise<CreateInviteResponse> {
  const { data, error } = await supabase.rpc('create_invite', params);
  
  if (error) {
    console.error('Error creating invite:', error);
    return { success: false, error: error.message };
  }
  
  return (data as unknown) as CreateInviteResponse;
}

/**
 * @deprecated Use the edge function `org-invitations-accept` instead.
 * This RPC-based function doesn't validate email match or set current_org_id.
 * 
 * Accept an invitation via the edge function (preferred method):
 * ```typescript
 * const { data, error } = await supabase.functions.invoke('org-invitations-accept', {
 *   method: 'POST',
 *   body: { token },
 * });
 * ```
 * 
 * The edge function provides:
 * - Email validation (ensures user email matches invite email)
 * - Sets profiles.current_org_id if user has no current org
 * - Comprehensive audit logging
 * - Proper error codes for different failure scenarios
 */
export async function acceptInvite(token: string): Promise<AcceptInviteResponse> {
  // Use the new edge function instead of the RPC
  const { data, error } = await supabase.functions.invoke('org-invitations-accept', {
    method: 'POST',
    body: { token },
  });
  
  if (error) {
    console.error('Error accepting invite:', error);
    return { success: false, error: error.message };
  }
  
  return data as AcceptInviteResponse;
}

/**
 * @deprecated Legacy RPC-based acceptance. Use acceptInvite() which now calls the edge function.
 * 
 * This function is kept for reference but should not be used in production.
 * It doesn't validate email match or set current_org_id.
 */
export async function acceptInviteViaRpc(token: string): Promise<AcceptInviteResponse> {
  console.warn('acceptInviteViaRpc is deprecated. Use acceptInvite() instead.');
  const { data, error } = await supabase.rpc('accept_invite', { p_token: token });
  
  if (error) {
    console.error('Error accepting invite via RPC:', error);
    return { success: false, error: error.message };
  }
  
  return (data as unknown) as AcceptInviteResponse;
}

/**
 * Generate a client-side invite acceptance link.
 */
export function generateInviteLink(token: string): string {
  return `/invite/accept?token=${token}`;
}

/**
 * Fetch invite details using the edge function (no auth required for viewing).
 * Returns invite details if valid, or error information if invalid/expired.
 */
export async function fetchInviteDetails(token: string): Promise<{
  success: boolean;
  invite?: {
    id: string;
    organization_id: string;
    email: string;
    role: string;
    status: string;
    expires_at: string;
    organization_name: string;
  };
  error?: string;
  error_code?: string;
}> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/org-invitations-accept?token=${encodeURIComponent(token)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error || 'Failed to fetch invitation',
        error_code: result.error_code || 'UNKNOWN_ERROR',
      };
    }

    return result;
  } catch (err) {
    console.error('Error fetching invite details:', err);
    return {
      success: false,
      error: 'Failed to fetch invitation details',
      error_code: 'FETCH_ERROR',
    };
  }
}
