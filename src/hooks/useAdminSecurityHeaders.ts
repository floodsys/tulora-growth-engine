import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Hook to apply strict security headers and policies to /admin* routes
 */
export const useAdminSecurityHeaders = () => {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  useEffect(() => {
    if (!isAdminRoute) return;

    // Apply CSP headers via meta tags for admin routes
    const addMetaTag = (name: string, content: string) => {
      // Remove existing meta tag if present
      const existing = document.querySelector(`meta[name="${name}"]`);
      if (existing) {
        existing.remove();
      }
      
      const meta = document.createElement('meta');
      meta.setAttribute('name', name);
      meta.setAttribute('content', content);
      document.head.appendChild(meta);
      return meta;
    };

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

    // Content Security Policy for admin routes
    const cspMeta = addHttpEquivTag(
      'Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " + // Allow inline scripts for React
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "img-src 'self' data: blob:; " +
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co; " +
      "frame-ancestors 'none'; " +
      "object-src 'none'; " +
      "base-uri 'self'; " +
      "form-action 'self'"
    );

    // Permissions Policy for admin routes
    const permissionsMeta = addMetaTag(
      'permissions-policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), ' +
      'accelerometer=(), autoplay=(), encrypted-media=(), fullscreen=(), ' +
      'gyroscope=(), magnetometer=(), midi=(), notifications=(), ' +
      'picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), ' +
      'sync-xhr=(), web-share=()'
    );

    // Referrer Policy for admin routes
    const referrerMeta = addMetaTag('referrer', 'strict-origin-when-cross-origin');

    // Additional security headers
    const xFrameOptionsMeta = addHttpEquivTag('X-Frame-Options', 'DENY');
    const xContentTypeOptionsMeta = addHttpEquivTag('X-Content-Type-Options', 'nosniff');
    const xXSSProtectionMeta = addHttpEquivTag('X-XSS-Protection', '1; mode=block');

    // Remove third-party scripts on admin routes
    const removeThirdPartyScripts = () => {
      // List of third-party script domains to remove on admin routes
      const thirdPartyDomains = [
        'google-analytics.com',
        'googletagmanager.com',
        'facebook.net',
        'twitter.com',
        'linkedin.com',
        'hotjar.com',
        'intercom.io',
        'segment.com',
        'mixpanel.com',
        'amplitude.com'
      ];

      // Remove scripts from third-party domains
      const scripts = document.querySelectorAll('script[src]');
      scripts.forEach(script => {
        const src = script.getAttribute('src');
        if (src && thirdPartyDomains.some(domain => src.includes(domain))) {
          script.remove();
          console.log(`[Admin Security] Removed third-party script: ${src}`);
        }
      });

      // Remove tracking pixels and beacons
      const images = document.querySelectorAll('img[src]');
      images.forEach(img => {
        const src = img.getAttribute('src');
        if (src && thirdPartyDomains.some(domain => src.includes(domain))) {
          img.remove();
          console.log(`[Admin Security] Removed tracking pixel: ${src}`);
        }
      });
    };

    // Set secure cookie policies for admin routes
    const setSecureCookiePolicy = () => {
      // Override document.cookie setter to enforce SameSite=Strict for admin routes
      let originalCookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie') ||
                                   Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'cookie');
      
      if (originalCookieDescriptor) {
        Object.defineProperty(document, 'cookie', {
          get: originalCookieDescriptor.get,
          set: function(val: string) {
            // For admin routes, enforce SameSite=Strict and Secure flags
            if (val && !val.includes('SameSite=')) {
              val += '; SameSite=Strict';
            }
            if (val && !val.includes('Secure') && window.location.protocol === 'https:') {
              val += '; Secure';
            }
            if (val && !val.includes('HttpOnly') && !val.includes('auth-token')) {
              // Don't add HttpOnly to auth tokens as they need to be accessible to JS
              val += '; HttpOnly';
            }
            return originalCookieDescriptor?.set?.call(this, val);
          },
          configurable: true
        });
      }
    };

    // Apply all security measures
    removeThirdPartyScripts();
    setSecureCookiePolicy();

    // Log security enforcement
    console.log('[Admin Security] Applied strict security headers for admin route:', location.pathname);

    // Cleanup function to remove security headers when leaving admin routes
    return () => {
      if (!location.pathname.startsWith('/admin')) {
        cspMeta?.remove();
        permissionsMeta?.remove();
        referrerMeta?.remove();
        xFrameOptionsMeta?.remove();
        xContentTypeOptionsMeta?.remove();
        xXSSProtectionMeta?.remove();
        
        console.log('[Admin Security] Removed strict security headers - left admin route');
      }
    };
  }, [isAdminRoute, location.pathname]);

  return { isAdminRoute };
};