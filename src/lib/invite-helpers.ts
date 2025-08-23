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
  role?: string;
  message?: string;
  error?: string;
  error_code?: string;
}

export async function createInvite(params: CreateInviteParams): Promise<CreateInviteResponse> {
  const { data, error } = await supabase.rpc('create_invite', params);
  
  if (error) {
    console.error('Error creating invite:', error);
    return { success: false, error: error.message };
  }
  
  return (data as unknown) as CreateInviteResponse;
}

export async function acceptInvite(token: string): Promise<AcceptInviteResponse> {
  const { data, error } = await supabase.rpc('accept_invite', { p_token: token });
  
  if (error) {
    console.error('Error accepting invite:', error);
    return { success: false, error: error.message };
  }
  
  return (data as unknown) as AcceptInviteResponse;
}

export function generateInviteLink(token: string): string {
  return `/invite/accept?token=${token}`;
}