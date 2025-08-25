import { ReactNode } from 'react';
import { useAdminSecurityHeaders } from '@/hooks/useAdminSecurityHeaders';

interface AdminSecurityWrapperProps {
  children: ReactNode;
}

/**
 * Security wrapper component that applies strict security policies to admin routes
 */
export const AdminSecurityWrapper = ({ children }: AdminSecurityWrapperProps) => {
  const { isAdminRoute } = useAdminSecurityHeaders();

  return (
    <>
      {children}
      {isAdminRoute && (
        <div style={{ display: 'none' }} data-admin-security="true">
          {/* Hidden marker for admin security enforcement */}
        </div>
      )}
    </>
  );
};