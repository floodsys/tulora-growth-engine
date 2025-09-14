import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

/**
 * Redirect component for the deprecated /settings/teams route.
 * Permanently redirects to /settings/organization/team with query params preserved.
 */
export const RedirectToOrganizationTeam = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  useEffect(() => {
    // Preserve query parameters in redirect
    const queryString = searchParams.toString();
    const newPath = `/settings/organization/team${queryString ? `?${queryString}` : ''}`;
    
    // Use replace to simulate a 308 permanent redirect
    navigate(newPath, { replace: true });
  }, [navigate, searchParams]);

  // Return null as this component only handles redirects
  return null;
};