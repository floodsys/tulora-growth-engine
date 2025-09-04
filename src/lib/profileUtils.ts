import { supabase } from '@/integrations/supabase/client';

export interface ProfileData {
  user_id: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  organization_name?: string;
  organization_size?: string;
  industry?: string;
}

/**
 * Safely upsert profile data without overwriting existing non-empty fields
 */
export async function safeProfileUpsert(newData: ProfileData) {
  if (!newData.user_id) {
    throw new Error('user_id is required for profile upsert');
  }

  // First get existing profile to avoid overwriting non-empty fields
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', newData.user_id)
    .single();

  // Merge data, only updating fields that are provided and not empty
  const mergedData: ProfileData = {
    user_id: newData.user_id,
  };

  // Only update fields that are provided and not empty, or if existing field is empty
  Object.keys(newData).forEach((key) => {
    const typedKey = key as keyof ProfileData;
    const newValue = newData[typedKey];
    const existingValue = existingProfile?.[typedKey];
    
    // Update if:
    // 1. New value is provided and not empty, OR
    // 2. Existing value is empty/null and we have a new value
    if (newValue && newValue.trim() !== '') {
      mergedData[typedKey] = newValue;
    } else if (!existingValue && newValue) {
      mergedData[typedKey] = newValue;
    } else if (existingValue) {
      // Keep existing value if new value is empty
      mergedData[typedKey] = existingValue;
    }
  });

  // Perform the upsert
  const { data, error } = await supabase
    .from('profiles')
    .upsert(mergedData, {
      onConflict: 'user_id'
    })
    .select()
    .single();

  return { data, error };
}

/**
 * Split full name into first and last name parts
 */
export function splitFullName(fullName: string) {
  const nameParts = fullName.trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  return { firstName, lastName };
}
