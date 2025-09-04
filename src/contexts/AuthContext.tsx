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
    // Debug: Check what's in localStorage
    console.log('🔍 LocalStorage auth keys:', Object.keys(localStorage).filter(key => key.includes('auth') || key.includes('supabase')));
    Object.keys(localStorage).forEach(key => {
      if (key.includes('auth') || key.includes('supabase')) {
        console.log('🔍 Storage key:', key, 'Value preview:', localStorage.getItem(key)?.substring(0, 100));
      }
    });

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('🔐 Auth state changed:', event, 'User:', session?.user?.email, 'ID:', session?.user?.id);
        
        // Additional debugging for unexpected sessions
        if (session?.user?.email === 'admin@axionstack.xyz' && event !== 'SIGNED_OUT') {
          console.error('⚠️ UNEXPECTED ADMIN SESSION LOADED! Event:', event);
          console.log('⚠️ Session details:', {
            expires_at: session.expires_at,
            expires_in: session.expires_in,
            token_type: session.token_type
          });
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('🔍 Initial session check:', session?.user?.email, 'ID:', session?.user?.id);
      
      if (session?.user?.email === 'admin@axionstack.xyz') {
        console.error('⚠️ UNEXPECTED ADMIN SESSION IN INITIAL CHECK!');
        console.log('⚠️ This session should not exist after signout');
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
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