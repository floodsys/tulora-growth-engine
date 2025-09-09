/**
 * Shared SuiteCRM Client for Edge Functions
 * 
 * Unit Acceptance:
 * - If SUITECRM_CLIENT_ID/SECRET missing → `SuiteCRM: SUITECRM_CLIENT_ID or SUITECRM_CLIENT_SECRET missing`
 * - If SUITECRM_BASE_URL missing → `SuiteCRM: SUITECRM_BASE_URL missing`
 * - If SUITECRM_AUTH_MODE != client_credentials → `SuiteCRM: Unsupported auth mode 'X'`
 */

interface TokenCache {
  access_token: string;
  expires_at: number;
}

interface CheckTokenResult {
  ok: boolean;
  mode: string;
  seconds_left?: number;
  error?: string;
}

interface CrmFetchOptions {
  retryOn401?: boolean;
}

class SuiteCRMClient {
  private readonly authMode: string;
  private readonly tokenUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl: string;
  private readonly version: string;
  private tokenCache: TokenCache | null = null;

  constructor() {
    // Validate auth mode first
    this.authMode = Deno.env.get('SUITECRM_AUTH_MODE') || '';
    if (this.authMode !== 'client_credentials') {
      throw new Error(`SuiteCRM: Unsupported auth mode '${this.authMode}'`);
    }

    // Validate required environment variables
    this.clientId = Deno.env.get('SUITECRM_CLIENT_ID') || '';
    this.clientSecret = Deno.env.get('SUITECRM_CLIENT_SECRET') || '';
    
    if (!this.clientId || !this.clientSecret) {
      throw new Error('SuiteCRM: SUITECRM_CLIENT_ID or SUITECRM_CLIENT_SECRET missing');
    }

    const baseUrl = Deno.env.get('SUITECRM_BASE_URL');
    if (!baseUrl) {
      throw new Error('SuiteCRM: SUITECRM_BASE_URL missing');
    }

    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.version = Deno.env.get('SUITECRM_VERSION') || 'V8';
    
    // Build token URL
    this.tokenUrl = Deno.env.get('SUITECRM_TOKEN_URL') || `${this.baseUrl}/Api/access_token`;
  }

  getMode(): "client_credentials" {
    return "client_credentials";
  }

  checkToken(): CheckTokenResult {
    if (!this.tokenCache) {
      return {
        ok: false,
        mode: this.authMode,
        error: 'No token cached'
      };
    }

    const now = Math.floor(Date.now() / 1000);
    const secondsLeft = this.tokenCache.expires_at - now;

    if (secondsLeft <= 0) {
      return {
        ok: false,
        mode: this.authMode,
        error: 'Token expired'
      };
    }

    return {
      ok: true,
      mode: this.authMode,
      seconds_left: secondsLeft
    };
  }

  private async refreshToken(): Promise<void> {
    console.info('suitecrm.token_refresh', { mode: this.authMode });

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret
    });

    try {
      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.access_token) {
        throw new Error('No access token in response');
      }

      // Cache token with 30s early refresh
      const expiresIn = data.expires_in || 3600; // Default to 1 hour
      const expiresAt = Math.floor(Date.now() / 1000) + expiresIn - 30; // 30s early refresh

      this.tokenCache = {
        access_token: data.access_token,
        expires_at: expiresAt
      };

      console.info('suitecrm.token_cached', { 
        mode: this.authMode, 
        expires_in: expiresIn,
        early_refresh_seconds: 30
      });
    } catch (error) {
      throw new Error(`SuiteCRM authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async ensureValidToken(): Promise<string> {
    const tokenCheck = this.checkToken();
    
    // Refresh if no token, expired, or expiring soon (already handled in checkToken with 30s buffer)
    if (!tokenCheck.ok || (tokenCheck.seconds_left && tokenCheck.seconds_left < 30)) {
      await this.refreshToken();
    }

    return this.tokenCache!.access_token;
  }

  /**
   * Helper to build API URLs
   * @param path - Relative API path like "module/Leads" 
   * @returns Full API URL like "${BASE}/Api/V8/module/Leads"
   */
  private api(path: string): string {
    const cleanPath = path.replace(/^\/+/, '');
    return `${this.baseUrl}/Api/${this.version}/${cleanPath}`;
  }

  /**
   * Make authenticated requests to SuiteCRM
   * @param pathOrAbsolute - Either relative API path or absolute URL
   * @param init - Fetch init options
   * @param options - Additional options like retryOn401
   */
  async crmFetch(
    pathOrAbsolute: string, 
    init: RequestInit = {}, 
    options: CrmFetchOptions = {}
  ): Promise<Response> {
    const { retryOn401 = true } = options;
    
    // Determine if it's a relative path or absolute URL
    const url = pathOrAbsolute.startsWith('http') 
      ? pathOrAbsolute 
      : this.api(pathOrAbsolute);

    const token = await this.ensureValidToken();

    const requestInit: RequestInit = {
      ...init,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    };

    console.info('suitecrm.request', { 
      mode: this.authMode, 
      endpoint: url.replace(this.baseUrl, '[BASE]'), // Hide base URL for security
      method: requestInit.method || 'GET'
    });

    const response = await fetch(url, requestInit);

    // Handle 401 with retry
    if (response.status === 401 && retryOn401) {
      console.info('suitecrm.401_retry', { mode: this.authMode });
      
      // Force token refresh
      this.tokenCache = null;
      const newToken = await this.ensureValidToken();
      
      const retryInit: RequestInit = {
        ...requestInit,
        headers: {
          ...requestInit.headers,
          'Authorization': `Bearer ${newToken}`,
        },
      };

      const retryResponse = await fetch(url, retryInit);
      console.info('suitecrm.request', { 
        mode: this.authMode, 
        endpoint: url.replace(this.baseUrl, '[BASE]'),
        method: retryInit.method || 'GET',
        status: retryResponse.status,
        retry: true
      });

      return retryResponse;
    }

    console.info('suitecrm.request', { 
      mode: this.authMode, 
      endpoint: url.replace(this.baseUrl, '[BASE]'),
      method: requestInit.method || 'GET',
      status: response.status
    });

    return response;
  }
}

// Export singleton instance
let clientInstance: SuiteCRMClient | null = null;

export function getSuiteCRMClient(): SuiteCRMClient {
  if (!clientInstance) {
    clientInstance = new SuiteCRMClient();
  }
  return clientInstance;
}

// Export types for other functions to use
export type { CheckTokenResult, CrmFetchOptions };