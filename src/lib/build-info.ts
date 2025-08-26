// Build information and cache management utilities

// Source of truth = DB (public.superadmins + GUC fallback inside is_superadmin). Env checks are cosmetic only.
export const BUILD_ID = import.meta.env.VITE_BUILD_ID || `build-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
export const BUILD_TIMESTAMP = new Date().toISOString();

// COSMETIC ONLY - These environment variables are NEVER used for authorization
// Source of truth = DB (public.superadmins + GUC fallback inside is_superadmin)
export function getCosmenticEnvVars() {
  // Frontend env (client-side only)
  const frontendEnv = import.meta.env.VITE_SUPERADMINS_EMAILS || null;
  
  return {
    frontend: frontendEnv,
    // Note: Server/edge env vars (SUPERADMINS_EMAILS, superadmins_emails) 
    // are not accessible from client-side code and should only be read
    // in edge functions for logging/UI hints, never for authorization
    note: "These are for UI hints and logging only. Authorization always uses DB RPC."
  };
}

export interface CacheClearResult {
  serviceWorkersCleared: number;
  cachesCleared: string[];
  success: boolean;
  error?: string;
}

export async function clearAllCaches(): Promise<CacheClearResult> {
  const result: CacheClearResult = {
    serviceWorkersCleared: 0,
    cachesCleared: [],
    success: false
  };

  try {
    // Clear service workers if available
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      
      for (const registration of registrations) {
        await registration.unregister();
        result.serviceWorkersCleared++;
      }
    }

    // Clear all caches if available
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      
      for (const cacheName of cacheNames) {
        await caches.delete(cacheName);
        result.cachesCleared.push(cacheName);
      }
    }

    // Clear localStorage and sessionStorage
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      // Some browsers may restrict this
      console.warn('Could not clear storage:', e);
    }

    result.success = true;
    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    return result;
  }
}

export function forceReload(): void {
  // Force a hard reload bypassing cache
  window.location.reload();
}

export function getBuildInfo() {
  return {
    buildId: BUILD_ID,
    buildTimestamp: BUILD_TIMESTAMP,
    userAgent: navigator.userAgent,
    url: window.location.href,
    timestamp: new Date().toISOString()
  };
}