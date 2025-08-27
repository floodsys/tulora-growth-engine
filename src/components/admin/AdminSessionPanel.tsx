import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, ShieldCheck, ShieldX, RefreshCw, Trash2, HardDrive } from 'lucide-react';
import { useAdminSession } from '@/hooks/useAdminSession';

export function AdminSessionPanel() {
  const { session, loading, verifying, verifyStepUp, clearSession, hardRefreshCache, testStepUp } = useAdminSession();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Admin Session
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Checking session...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isValid = session?.valid;
  const isExpired = session && !session.valid && session.reason?.includes('expired');
  
  return (
    <Card className={`${
      isValid 
        ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20' 
        : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20'
    }`}>
      <CardHeader>
        <CardTitle className={`flex items-center gap-2 ${
          isValid 
            ? 'text-green-800 dark:text-green-200' 
            : 'text-red-800 dark:text-red-200'
        }`}>
          {isValid ? <ShieldCheck className="h-5 w-5" /> : <ShieldX className="h-5 w-5" />}
          Admin Session
          <Badge variant={isValid ? "default" : "destructive"} className="ml-auto">
            {isValid ? 'Active' : 'Invalid'}
          </Badge>
        </CardTitle>
        <CardDescription className={
          isValid 
            ? 'text-green-700 dark:text-green-300' 
            : 'text-red-700 dark:text-red-300'
        }>
          Elevated admin session • TTL: 12 hours
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {session && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Issued At:</strong>
              <div className="font-mono text-xs">
                {session.issued_at ? new Date(session.issued_at).toLocaleString() : 'N/A'}
              </div>
            </div>
            <div>
              <strong>Age:</strong>
              <div className={`font-mono ${
                isValid 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {session.age_minutes !== undefined ? `${session.age_minutes} min` : 'N/A'}
              </div>
            </div>
            <div>
              <strong>TTL Remaining:</strong>
              <div className={`font-mono ${
                isValid 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {session.ttl_minutes !== undefined ? `${session.ttl_minutes} min` : 'N/A'}
              </div>
            </div>
            <div>
              <strong>Status:</strong>
              <div className={`font-mono text-xs ${
                isValid 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {session.reason || 'Unknown'}
              </div>
            </div>
          </div>
        )}

        <div className="border-t pt-4 space-y-3">
          <div className="text-xs text-muted-foreground space-y-1">
            <div><strong>Current Host:</strong> {window.location.host}</div>
            <div><strong>Environment:</strong> {
              window.location.host.includes('localhost') ? 'localhost (dev)' :
              window.location.host.includes('lovable.app') ? 'preview (.lovable.app)' :
              window.location.host.includes('tulora.io') ? 'production (.tulora.io)' : 'unknown'
            }</div>
            <div><strong>Cookie:</strong> sa_issued (HttpOnly, Path=/, SameSite=Lax{window.location.protocol === 'https:' ? ', Secure' : ''})</div>
          </div>
          
          {session?.last_validate_time && (
            <div className="text-xs">
              <strong>Last Validate Result:</strong>
              <div className="font-mono text-xs mt-1 space-y-1">
                <div>Time: {new Date(session.last_validate_time).toLocaleString()}</div>
                <div>Endpoint: {session.validate_endpoint}</div>
                <div className={session.cookie_present ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                  Cookie present: {session.cookie_present ? 'true' : 'false'}
                </div>
                <div className={session.valid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                  Validation outcome: {session.valid ? 'SUCCESS' : 'FAILED'}
                </div>
                <div className="text-muted-foreground">
                  Cookie forwarding: ✓ (document.cookie sent to edge function)
                </div>
                {document.cookie.split(';').filter(c => c.trim().startsWith('sa_issued=')).length > 1 && (
                  <div className="text-yellow-600 dark:text-yellow-400">
                    ⚠ Multiple sa_issued cookies detected - may cause conflicts
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={verifyStepUp}
              disabled={verifying}
              size="sm"
              variant={isValid ? "outline" : "default"}
            >
              {verifying ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  {isValid ? 'Renew Session' : 'Start Step-Up Auth'}
                </>
              )}
            </Button>

            {window.location.host.includes('lovable.app') && (
              <Button
                onClick={testStepUp}
                size="sm"
                variant="outline"
                className="bg-orange-50 border-orange-200 text-orange-800 hover:bg-orange-100 dark:bg-orange-950 dark:border-orange-800 dark:text-orange-200"
              >
                <Shield className="h-4 w-4 mr-2" />
                Headless Test
              </Button>
            )}

            {isValid && (
              <Button
                onClick={clearSession}
                size="sm"
                variant="outline"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Session
              </Button>
            )}

            <Button
              onClick={hardRefreshCache}
              size="sm"
              variant="outline"
            >
              <HardDrive className="h-4 w-4 mr-2" />
              Hard Refresh Cache
            </Button>
          </div>
        </div>

        {isExpired && (
          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
            <div className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Session Expired:</strong> Your elevated admin session has expired after 12 hours. 
              Please complete step-up authentication to continue.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}