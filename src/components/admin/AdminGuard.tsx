import { ReactNode } from 'react';

interface AdminGuardProps {
  children: ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  console.log('AdminGuard component loaded - bypassing all authentication');
  
  // Completely bypass all authentication - just render the children
  return <>{children}</>;
}