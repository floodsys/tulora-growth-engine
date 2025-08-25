import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DiagnosticData {
  authUid: string | null;
  authEmail: string | null;
  dbSuperadminCheck: boolean | null;
  frontendEnv: string | null;
  finalGuardDecision: boolean | null;
  error?: string;
}

export default function AdminDiagnostic() {
  const { user } = useAuth();
  const [diagnosticData, setDiagnosticData] = useState<DiagnosticData>({
    authUid: null,
    authEmail: null,
    dbSuperadminCheck: null,
    frontendEnv: null,
    finalGuardDecision: null,
  });
  const [isLoading, setIsLoading] = useState(false);

  const runDiagnostics = async () => {
    setIsLoading(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      let dbCheck: boolean | null = null;
      let guardDecision: boolean | null = null;
      let error: string | undefined;

      if (currentUser) {
        try {
          // Test DB RPC call - Source of truth for superadmin status
          const { data: isSuperadmin, error: rpcError } = await supabase.rpc('is_superadmin');
          
          if (rpcError) {
            error = `DB RPC Error: ${rpcError.message}`;
            dbCheck = null;
          } else {
            dbCheck = Boolean(isSuperadmin);
          }

          // Simulate the final guard decision logic
          guardDecision = dbCheck;
        } catch (err) {
          error = `Exception in diagnostics: ${err instanceof Error ? err.message : String(err)}`;
        }
      }

      setDiagnosticData({
        authUid: currentUser?.id || null,
        authEmail: currentUser?.email || null,
        dbSuperadminCheck: dbCheck,
        frontendEnv: import.meta.env.VITE_SUPERADMINS_EMAILS || null, // Cosmetic only - not used for auth
        finalGuardDecision: guardDecision,
        error
      });
    } catch (err) {
      setDiagnosticData(prev => ({
        ...prev,
        error: `Diagnostic error: ${err instanceof Error ? err.message : String(err)}`
      }));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const StatusIcon = ({ status }: { status: boolean | null }) => {
    if (status === null) return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
    return status ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />;
  };

  const StatusBadge = ({ status }: { status: boolean | null }) => {
    if (status === null) return <Badge variant="secondary">Unknown</Badge>;
    return status ? <Badge variant="default" className="bg-green-500">Pass</Badge> : <Badge variant="destructive">Fail</Badge>;
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Admin Diagnostic</h1>
            <p className="text-muted-foreground">Diagnosing superadmin authorization flow</p>
          </div>
          <Button onClick={runDiagnostics} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Re-check
          </Button>
        </div>

        {diagnosticData.error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Error:</strong> {diagnosticData.error}
            </AlertDescription>
          </Alert>
        )}

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Source of truth = DB (public.superadmins + GUC fallback inside is_superadmin). Env checks are cosmetic only.</strong>
          </AlertDescription>
        </Alert>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <StatusIcon status={!!diagnosticData.authUid} />
                Authentication Session
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="font-medium">User ID:</span>
                <code className="text-sm bg-muted px-2 py-1 rounded">
                  {diagnosticData.authUid || 'Not authenticated'}
                </code>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Email:</span>
                <code className="text-sm bg-muted px-2 py-1 rounded">
                  {diagnosticData.authEmail || 'Not available'}
                </code>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <StatusIcon status={diagnosticData.dbSuperadminCheck} />
                Database RPC Check (is_superadmin)
                <StatusBadge status={diagnosticData.dbSuperadminCheck} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between">
                <span className="font-medium">Result:</span>
                <code className="text-sm bg-muted px-2 py-1 rounded">
                  {diagnosticData.dbSuperadminCheck !== null ? String(diagnosticData.dbSuperadminCheck) : 'Error/Unknown'}
                </code>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                This is the authoritative source for superadmin status. Checks public.superadmins table first, then GUC app.superadmin_emails as fallback.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Frontend Environment (Cosmetic Only)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between">
                <span className="font-medium">VITE_SUPERADMINS_EMAILS:</span>
                <code className="text-sm bg-muted px-2 py-1 rounded">
                  {diagnosticData.frontendEnv || 'Not set'}
                </code>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                This env var is for UI hints only and should NOT block access to /admin.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <StatusIcon status={diagnosticData.finalGuardDecision} />
                Final Guard Decision
                <StatusBadge status={diagnosticData.finalGuardDecision} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between">
                <span className="font-medium">Access Granted:</span>
                <code className="text-sm bg-muted px-2 py-1 rounded">
                  {diagnosticData.finalGuardDecision !== null ? String(diagnosticData.finalGuardDecision) : 'Unknown'}
                </code>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                This should match the DB RPC check result exactly. If it doesn't, there's a logic error in the guard.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {diagnosticData.finalGuardDecision === true ? (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  ✅ All checks pass. You should have access to /admin.
                </AlertDescription>
              </Alert>
            ) : diagnosticData.finalGuardDecision === false ? (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  ❌ Access denied. DB reports you are not a superadmin.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  ⚠️ Cannot determine access status due to errors above.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}