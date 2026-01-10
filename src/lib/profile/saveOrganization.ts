import { supabase } from '@/integrations/supabase/client';
import { ProfileData, safeProfileUpsert, splitFullName } from '@/lib/profileUtils';
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
  authMetadataWarning?: string;
  orgId?: string;
}

export async function saveOrganization({
  userId,
  fullName,
  organizationData,
  source = 'signup'
}: SaveOrganizationParams): Promise<SaveOrganizationResult> {
  try {
    // Step 1: Fetch profile row to check if current_org_id exists
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('user_id, current_org_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching profile:', fetchError);
      // Continue anyway - profile might not exist yet
    }

    const existingOrgId = existingProfile?.current_org_id;

    // Step 2: Prepare profile data for upsert (always upsert profile fields)
    const profileData: ProfileData = {
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

    // Step 3: If current_org_id already exists, just upsert profile and return
    if (existingOrgId) {
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

        if (authError) {
          console.error('Auth metadata update error:', authError);
          telemetry.track('profile_save_authmeta_failed', { 
            source, 
            error_code: authError.message 
          });
          
          return { 
            ok: true, 
            orgId: existingOrgId,
            authMetadataWarning: 'Some account settings may take a moment to sync.' 
          };
        }
      }

      telemetry.profileSaved(source);
      return { ok: true, orgId: existingOrgId };
    }

    // Step 4: No current_org_id - check if user already owns an organization (idempotent)
    let orgId: string;
    let orgWasCreated = false;

    // First, check if user already owns an organization
    const { data: existingOrg, error: existingOrgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('owner_user_id', userId)
      .maybeSingle();

    if (existingOrgError) {
      console.error('Error checking for existing org:', existingOrgError);
      // Continue and try to create - unique constraint will catch duplicates
    }

    if (existingOrg) {
      // User already owns an organization, reuse it
      orgId = existingOrg.id;
      console.log('Reusing existing organization:', orgId);
      telemetry.track('organization_reused', { source, org_id: orgId });
    } else {
      // No existing org, try to create a new one
      const { data: newOrg, error: orgError } = await supabase
        .from('organizations')
        .insert({
          owner_user_id: userId,
          name: organizationData.organization_name,
          industry: organizationData.industry,
          size_band: organizationData.organization_size,
        })
        .select('id')
        .single();

      if (orgError) {
        // Check if this is a unique constraint violation (race condition)
        const isUniqueViolation = orgError.code === '23505' || 
          orgError.message?.includes('unique') ||
          orgError.message?.includes('duplicate');
        
        if (isUniqueViolation) {
          // Race condition: another request created the org. Re-query and use that one.
          console.log('Unique constraint hit, re-querying for existing org');
          
          const { data: raceOrg, error: raceError } = await supabase
            .from('organizations')
            .select('id')
            .eq('owner_user_id', userId)
            .single();
          
          if (raceError || !raceOrg) {
            console.error('Failed to fetch org after race condition:', raceError);
            return {
              ok: false,
              error: 'Failed to create organization. Please try again.'
            };
          }
          
          orgId = raceOrg.id;
          telemetry.track('organization_race_resolved', { source, org_id: orgId });
        } else {
          // Some other error
          console.error('Organization creation error:', orgError);
          return {
            ok: false,
            error: 'Failed to create organization. Please try again.'
          };
        }
      } else if (!newOrg) {
        console.error('Organization creation returned no data');
        return {
          ok: false,
          error: 'Failed to create organization. Please try again.'
        };
      } else {
        orgId = newOrg.id;
        orgWasCreated = true;
      }
    }

    // Step 5: Ensure organization_members row exists (idempotent upsert)
    // First check if membership already exists
    const { data: existingMember, error: memberCheckError } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .maybeSingle();

    if (memberCheckError) {
      console.error('Error checking for existing member:', memberCheckError);
      // Continue and try to insert
    }

    if (!existingMember) {
      // No existing membership, create one
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: orgId,
          user_id: userId,
          role: 'admin',
          seat_active: true,
        });

      if (memberError) {
        // Check if this is a unique constraint violation (race condition)
        const isMemberDuplicate = memberError.code === '23505' || 
          memberError.message?.includes('unique') ||
          memberError.message?.includes('duplicate');
        
        if (!isMemberDuplicate) {
          console.error('Organization member creation error:', memberError);
          // Still try to continue - the org exists
          telemetry.track('org_member_creation_failed', { 
            source, 
            error_code: memberError.message,
            org_id: orgId
          });
        }
        // If it's a duplicate, that's fine - membership already exists
      }
    }

    // Step 6: Update profiles with current_org_id and other fields
    profileData.current_org_id = orgId;
    
    const { error: profileError } = await safeProfileUpsert(profileData);
    
    if (profileError) {
      console.error('Profile upsert error:', profileError);
      return {
        ok: false,
        orgId: orgId, // Return orgId even on profile error since org exists
        error: 'Organization created but failed to update profile. Please try again.'
      };
    }

    // Step 7: Update auth user metadata if full name provided
    if (fullName?.trim() && firstName && lastName) {
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: fullName.trim(),
          first_name: firstName,
          last_name: lastName
        }
      });

      if (authError) {
        console.error('Auth metadata update error:', authError);
        telemetry.track('profile_save_authmeta_failed', { 
          source, 
          error_code: authError.message 
        });
        
        return { 
          ok: true, 
          orgId: orgId,
          authMetadataWarning: 'Some account settings may take a moment to sync.' 
        };
      }
    }

    // Track successful profile and org creation/reuse
    telemetry.profileSaved(source);
    if (orgWasCreated) {
      telemetry.track('organization_created', { source, org_id: orgId });
    }

    return { ok: true, orgId: orgId };

  } catch (error) {
    console.error('Save organization error:', error);
    return {
      ok: false,
      error: 'An unexpected error occurred. Please try again.'
    };
  }
}
