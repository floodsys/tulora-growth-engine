import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let subscription: any = null;

    // Force clear any stale sessions on mount
    const clearStaleSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email === 'admin@axionstack.xyz') {
        console.warn('Clearing stale admin session');
        await supabase.auth.signOut({ scope: 'global' });
        // Clear all auth-related localStorage
        Object.keys(localStorage).forEach(key => {
          if (key.includes('supabase') || key.includes('auth')) {
            localStorage.removeItem(key);
          }
        });
        return;
      }
    };

    const initAuth = async () => {
      await clearStaleSession();
      
      // Set up auth state listener
      const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        }
      );
      
      subscription = authSubscription;

      // Check for existing session
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    };

    initAuth();

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const signOut = async () => {
    // Clear all auth state before signing out
    setUser(null);
    setSession(null);
    setLoading(true);
    
    // Sign out and clear all sessions
    await supabase.auth.signOut({ scope: 'global' });
    
    // Clear any residual localStorage data
    localStorage.removeItem('supabase.auth.token');
    localStorage.removeItem('sb-nkjxbeypbiclvouqfjyc-auth-token');
    
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}