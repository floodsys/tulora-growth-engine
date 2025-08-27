import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAdminSession } from '@/hooks/useAdminSession';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';

interface DiagnosticInfo {
  host: string;
  environment: 'localhost' | 'preview' | 'production';
  cookieAttributes: {
    domain: string;
    path: string;
    sameSite: string;
    secure: boolean;
    httpOnly: boolean;
  };
  lastValidateResult?: {
    timestamp: string;
    url: string;
    cookie_present: boolean;
    outcome: string;
    session_age_sec?: number;
    ttl_sec?: number;
  };
  duplicateCookies: boolean;
  allCookies: string[];
}

export default function AdminDiagnostic() {
  const { session, checkSession } = useAdminSession();
  const [diagnostics, setDiagnostics] = useState<DiagnosticInfo | null>(null);

  const detectEnvironment = (): 'localhost' | 'preview' | 'production' => {
    const host = window.location.host;
    if (host.includes('localhost') || host.includes('127.0.0.1')) return 'localhost';
    if (host.includes('lovable.app')) return 'preview';
    if (host.includes('tulora.io')) return 'production';
    return 'localhost';
  };

  const getCookieAttributes = (env: string) => {
    const isLocalhost = env === 'localhost';
    const isProd = env === 'production';
    const isPreview = env === 'preview';
    
    return {
      domain: isLocalhost ? 'host-only' : (isProd ? '.tulora.io' : '.lovable.app'),
      path: '/',
      sameSite: 'Lax',
      secure: !isLocalhost,
      httpOnly: true
    };
  };

  const getAllCookies = (): string[] => {
    return document.cookie.split(';').map(c => c.trim()).filter(c => c.length > 0);
  };

  const checkDuplicateCookies = (): boolean => {
    const cookies = getAllCookies();
    const saIssuedCookies = cookies.filter(c => c.startsWith('sa_issued='));
    return saIssuedCookies.length > 1;
  };

  const runDiagnostics = async () => {
    const host = window.location.host;
    const env = detectEnvironment();
    const cookieAttributes = getCookieAttributes(env);
    const allCookies = getAllCookies();
    const duplicateCookies = checkDuplicateCookies();

    // Perform validation check to get last result
    let lastValidateResult;
    try {
      const session = await supabase.auth.getSession();
      const response = await fetch('/api/admin/validate', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${session.data.session?.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        lastValidateResult = {
          timestamp: new Date().toISOString(),
          url: '/api/admin/validate',
          cookie_present: data.cookie_present,
          outcome: data.outcome,
          session_age_sec: data.session_age_sec,
          ttl_sec: data.ttl_sec
        };
      }
    } catch (error) {
      console.error('Validation check failed:', error);
    }

    setDiagnostics({
      host,
      environment: env,
      cookieAttributes,
      lastValidateResult,
      duplicateCookies,
      allCookies
    });
  };

  useEffect(() => {
    runDiagnostics();
  }, [session]);

  if (!diagnostics) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Admin Session Diagnostics</CardTitle>
            <CardDescription>Loading diagnostic information...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Admin Session Diagnostics</CardTitle>
          <CardDescription>Current session and cookie configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Host & Environment */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Environment</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Host</p>
                <p className="font-mono">{diagnostics.host}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Detected Environment</p>
                <Badge variant={diagnostics.environment === 'production' ? 'default' : 'secondary'}>
                  {diagnostics.environment}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Cookie Attributes */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Cookie Attributes</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Domain</p>
                <p className="font-mono">{diagnostics.cookieAttributes.domain}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Path</p>
                <p className="font-mono">{diagnostics.cookieAttributes.path}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">SameSite</p>
                <p className="font-mono">{diagnostics.cookieAttributes.sameSite}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Secure</p>
                <Badge variant={diagnostics.cookieAttributes.secure ? 'default' : 'secondary'}>
                  {diagnostics.cookieAttributes.secure ? 'Yes' : 'No'}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">HttpOnly</p>
                <Badge variant={diagnostics.cookieAttributes.httpOnly ? 'default' : 'secondary'}>
                  {diagnostics.cookieAttributes.httpOnly ? 'Yes' : 'No'}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Last Validate Result */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Last Validate Result</h3>
            {diagnostics.lastValidateResult ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Timestamp</p>
                  <p className="font-mono text-sm">{new Date(diagnostics.lastValidateResult.timestamp).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">URL</p>
                  <p className="font-mono">{diagnostics.lastValidateResult.url}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cookie Present</p>
                  <Badge variant={diagnostics.lastValidateResult.cookie_present ? 'default' : 'destructive'}>
                    {diagnostics.lastValidateResult.cookie_present ? 'Yes' : 'No'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Outcome</p>
                  <Badge variant={diagnostics.lastValidateResult.outcome === 'valid' ? 'default' : 'destructive'}>
                    {diagnostics.lastValidateResult.outcome}
                  </Badge>
                </div>
                {diagnostics.lastValidateResult.session_age_sec !== undefined && (
                  <div>
                    <p className="text-sm text-muted-foreground">Session Age</p>
                    <p className="font-mono">{Math.floor(diagnostics.lastValidateResult.session_age_sec / 60)} minutes</p>
                  </div>
                )}
                {diagnostics.lastValidateResult.ttl_sec !== undefined && (
                  <div>
                    <p className="text-sm text-muted-foreground">TTL Remaining</p>
                    <p className="font-mono">{Math.floor(diagnostics.lastValidateResult.ttl_sec / 60)} minutes</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">No validation result available</p>
            )}
          </div>

          <Separator />

          {/* Cookie Issues */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Cookie Issues</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Duplicate sa_issued cookies found:</p>
                <Badge variant={diagnostics.duplicateCookies ? 'destructive' : 'default'}>
                  {diagnostics.duplicateCookies ? 'Yes - Clear cookies recommended' : 'No'}
                </Badge>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground mb-2">All cookies ({diagnostics.allCookies.length}):</p>
                <div className="bg-muted p-3 rounded-md">
                  {diagnostics.allCookies.length > 0 ? (
                    <pre className="text-xs font-mono whitespace-pre-wrap">
                      {diagnostics.allCookies.join('\n')}
                    </pre>
                  ) : (
                    <p className="text-xs text-muted-foreground">No cookies found</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex gap-4">
            <Button onClick={runDiagnostics} variant="outline">
              Refresh Diagnostics
            </Button>
            <Button onClick={checkSession} variant="outline">
              Re-check Session
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}