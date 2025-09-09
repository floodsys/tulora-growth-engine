import { ReactNode, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSuperadmin } from '@/hooks/useSuperadmin';
import { useToast } from '@/hooks/use-toast';

interface AdminGuardProps {
  children: ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  // Immediate test render to see if this component is reached
  return (
    <div style={{ padding: '20px', backgroundColor: 'red', color: 'white', fontSize: '24px' }}>
      🚨 ADMIN GUARD TEST - If you see this, the AdminGuard is working!
      <div style={{ backgroundColor: 'blue', padding: '10px', marginTop: '10px' }}>
        {children}
      </div>
    </div>
  );
}