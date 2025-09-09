import { useEffect } from 'react';

/**
 * Hook to apply Content Security Policy for contact form pages
 * Ensures Supabase endpoints are included in connect-src
 */
export const useContactFormSecurity = () => {
  useEffect(() => {
    // AGGRESSIVE SERVICE WORKER CLEANUP FIRST
    const killServiceWorkers = async () => {
      if ('serviceWorker' in navigator) {
        try {
          // Log current registrations
          const registrations = await navigator.serviceWorker.getRegistrations();
          console.log('[Contact Form Security] Current SW scopes:', registrations.map(r => r.scope));
          
          if (registrations.length > 0) {
            console.log('[Contact Form Security] Found service workers, unregistering ALL...');
            
            // Unregister all service workers
            await Promise.all(registrations.map(reg => reg.unregister()));
            
            // Clear all caches
            if ('caches' in window) {
              const cacheNames = await caches.keys();
              await Promise.all(cacheNames.map(name => caches.delete(name)));
              console.log('[Contact Form Security] Cleared caches:', cacheNames);
            }
            
            console.log('[Contact Form Security] All SWs unregistered, forcing hard reload...');
            window.location.reload();
            return; // Don't continue with CSP setup if we're reloading
          }
        } catch (error) {
          console.error('[Contact Form Security] SW cleanup error:', error);
        }
      }
    };

    // Kill SWs first, then set up CSP
    killServiceWorkers().then(() => {
      // Apply CSP header via meta tag for contact forms
      const addHttpEquivTag = (httpEquiv: string, content: string) => {
        // Remove existing meta tag if present
        const existing = document.querySelector(`meta[http-equiv="${httpEquiv}"]`);
        if (existing) {
          existing.remove();
        }
        
        const meta = document.createElement('meta');
        meta.setAttribute('http-equiv', httpEquiv);
        meta.setAttribute('content', content);
        document.head.appendChild(meta);
        return meta;
      };

      // Content Security Policy with Supabase endpoints in connect-src
      const cspMeta = addHttpEquivTag(
        'Content-Security-Policy',
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " + // Allow inline scripts for React
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "img-src 'self' data: blob:; " +
        "connect-src 'self' https://nkjxbeypbiclvouqfjyc.supabase.co https://nkjxbeypbiclvouqfjyc.functions.supabase.co https://*.supabase.co wss://*.supabase.co; " +
        "frame-ancestors 'self'; " +
        "object-src 'none'; " +
        "base-uri 'self'; " +
        "form-action 'self'"
      );

      console.log('[Contact Form Security] Applied CSP with Supabase endpoints');

      // Cleanup function to remove CSP when component unmounts
      return () => {
        cspMeta?.remove();
        console.log('[Contact Form Security] Removed CSP meta tag');
      };
    });
  }, []);
};