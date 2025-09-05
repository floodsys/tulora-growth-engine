interface ProfileData {
  organization_name?: string | null;
  organization_size?: string | null;
  industry?: string | null;
}

/**
 * Checks if a user profile has all required organization fields completed
 */
export function isProfileComplete(profile: ProfileData | null): boolean {
  if (!profile) {
    return false;
  }

  return Boolean(
    profile.organization_name?.trim() &&
    profile.organization_size?.trim() &&
    profile.industry?.trim()
  );
}