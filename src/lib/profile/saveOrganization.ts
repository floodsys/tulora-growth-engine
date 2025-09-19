import { supabase } from '@/integrations/supabase/client';
import { safeProfileUpsert, splitFullName } from '@/lib/profileUtils';
import { telemetry } from '@/lib/telemetry';

export interface OrganizationData {
  organization_name: string;
  organization_size: string;
  industry: string;
}

export interface SaveOrganizationParams {
  userId: string;
  fullName?: string;
  organizationData: OrganizationData;
  source?: 'signup' | 'onboarding'; // For telemetry
}

export interface SaveOrganizationResult {
  ok: boolean;
  error?: string;
}

export async function saveOrganization({
  userId,
  fullName,
  organizationData,
  source = 'signup'
}: SaveOrganizationParams): Promise<SaveOrganizationResult> {
  try {
    // Prepare profile data for upsert
    const profileData: any = {
      user_id: userId,
      organization_name: organizationData.organization_name,
      organization_size: organizationData.organization_size,
      industry: organizationData.industry,
    };

    // Handle full name if provided
    let firstName: string | undefined;
    let lastName: string | undefined;
    
    if (fullName?.trim()) {
      profileData.full_name = fullName.trim();
      const { firstName: fName, lastName: lName } = splitFullName(fullName.trim());
      firstName = fName;
      lastName = lName;
      profileData.first_name = firstName;
      profileData.last_name = lastName;
    }

    // Upsert profile data
    const { error: profileError } = await safeProfileUpsert(profileData);
    
    if (profileError) {
      console.error('Profile upsert error:', profileError);
      return {
        ok: false,
        error: 'Failed to save profile information. Please try again.'
      };
    }

    // Update auth user metadata if full name provided
    if (fullName?.trim() && firstName && lastName) {
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: fullName.trim(),
          first_name: firstName,
          last_name: lastName
        }
      });

      // Don't fail the entire operation if auth metadata update fails
      if (authError) {
        console.error('Auth metadata update error:', authError);
        telemetry.track('profile_save_warning', { 
          source, 
          issue: 'auth_metadata_update_failed',
          error_code: authError.message 
        });
        
        // This would be better handled by the calling component for UI feedback
        // but for now we'll log it and continue
      }
    }

    // Track successful profile save
    telemetry.profileSaved(source);

    return { ok: true };

  } catch (error) {
    console.error('Save organization error:', error);
    return {
      ok: false,
      error: 'An unexpected error occurred. Please try again.'
    };
  }
}