import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AdminGuard } from '@/components/guards/AdminGuard';
import { Timer, User, Database, Activity, Copy, ExternalLink, GitCommit } from 'lucide-react';
import { getBuildInfo, COMMIT_SHA, BUILD_ID, BUILD_TIMESTAMP } from '@/lib/build-info';

interface RpcTestResult {
  raw_data: any;
  normalized: boolean;
  timing_ms: number;
  timestamp: string;
}

interface AuditEntry {
  id: string;
  created_at: string;
  action: string;
  status: string;
  metadata: any;
}

export default function AdminSelfCheck() {
  const [rpcResult, setRpcResult] = useState<RpcTestResult | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied to clipboard",
        description: `${label} copied successfully`,
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const copyBuildInfo = async () => {
    const buildInfo = getBuildInfo();
    const text = `Commit: ${buildInfo.commitSha}\nBuild ID: ${buildInfo.buildId}\nBuild Time: ${buildInfo.buildTimestamp}`;
    await copyToClipboard(text, "Build information");
  };

  const normalizeBooleanResult = (data: any): boolean => {
    if (data === true || data === 't' || data === 'true') return true;
    if (data === false || data === 'f' || data === 'false') return false;
    if (data?.is_superadmin === true) return true;
    if (Array.isArray(data) && data[0]?.is_superadmin === true) return true;
    return false;
  };

  const runRpcTest = async () => {
    if (!user) return;

    setIsLoading(true);
    const startTime = performance.now();

    try {
      const { data, error } = await supabase.rpc('is_superadmin', { 
        user_id: user.id 
      });

      const endTime = performance.now();
      const timing_ms = Math.round(endTime - startTime);

      if (error) {
        throw error;
      }

      const result: RpcTestResult = {
        raw_data: data,
        normalized: normalizeBooleanResult(data),
        timing_ms,
        timestamp: new Date().toISOString()
      };

      setRpcResult(result);

      toast({
        title: "RPC Test Complete",
        description: `Result: ${result.normalized ? 'true' : 'false'} (${timing_ms}ms)`,
        variant: result.normalized ? "default" : "destructive",
      });

    } catch (error) {
      console.error('RPC test failed:', error);
      toast({
        title: "RPC Test Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAuditEntries = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('audit_log')
        .select('id, created_at, action, status, metadata')
        .eq('actor_user_id', user.id)
        .ilike('action', '%admin%')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setAuditEntries(data || []);
    } catch (error) {
      console.error('Failed to fetch audit entries:', error);
    }
  };

  useEffect(() => {
    if (user) {
      runRpcTest();
      fetchAuditEntries();
    }
  }, [user]);

  const projectUrl = import.meta.env.VITE_SUPABASE_URL || 'Not configured';
  const repoUrl = import.meta.env.VITE_REPO_URL;

  return (
    <AdminGuard>
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Admin Self-Check</h1>
            <p className="text-muted-foreground">
              Diagnostic page for debugging superadmin access issues
            </p>
          </div>

          {/* Environment Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Environment Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <strong className="text-sm">Project URL:</strong>
                  <p className="font-mono text-sm text-muted-foreground">{projectUrl}</p>
                </div>
                <div>
                  <strong className="text-sm">User ID:</strong>
                  <p className="font-mono text-sm text-muted-foreground">{user?.id}</p>
                </div>
                <div>
                  <strong className="text-sm">Email:</strong>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Build Version Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitCommit className="h-5 w-5" />
                Version Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <strong className="text-sm">Commit SHA:</strong>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="font-mono text-sm text-muted-foreground" data-testid="commit-sha">
                        {COMMIT_SHA}
                      </p>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => copyToClipboard(COMMIT_SHA, "Commit SHA")}
                        data-testid="copy-commit-sha"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      {repoUrl && COMMIT_SHA !== 'unknown' && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          asChild
                          data-testid="commit-link"
                        >
                          <a 
                            href={`${repoUrl}/commit/${COMMIT_SHA}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                  <div>
                    <strong className="text-sm">Build ID:</strong>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="font-mono text-sm text-muted-foreground" data-testid="build-id">
                        {BUILD_ID}
                      </p>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => copyToClipboard(BUILD_ID, "Build ID")}
                        data-testid="copy-build-id"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <strong className="text-sm">Build Time:</strong>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="font-mono text-sm text-muted-foreground" data-testid="build-timestamp">
                        {new Date(BUILD_TIMESTAMP).toLocaleString()}
                      </p>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => copyToClipboard(BUILD_TIMESTAMP, "Build timestamp")}
                        data-testid="copy-build-timestamp"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="pt-2">
                  <Button 
                    variant="outline" 
                    onClick={copyBuildInfo}
                    data-testid="copy-all-build-info"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy All Build Info
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Timer className="h-5 w-5" />
                RPC Function Test
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Button onClick={runRpcTest} disabled={isLoading}>
                    {isLoading ? 'Testing...' : 'Run RPC Test'}
                  </Button>
                  {rpcResult && (
                    <Badge variant={rpcResult.normalized ? "default" : "destructive"}>
                      {rpcResult.normalized ? 'PASS' : 'FAIL'}
                    </Badge>
                  )}
                </div>

                {rpcResult && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <strong className="text-sm">Raw Data:</strong>
                        <pre className="mt-1 p-2 bg-muted rounded text-xs font-mono">
                          {JSON.stringify(rpcResult.raw_data, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <strong className="text-sm">Normalized Result:</strong>
                        <p className="text-sm mt-1">
                          <Badge variant={rpcResult.normalized ? "default" : "destructive"}>
                            {rpcResult.normalized.toString()}
                          </Badge>
                        </p>
                      </div>
                      <div>
                        <strong className="text-sm">Timing:</strong>
                        <p className="text-sm mt-1">{rpcResult.timing_ms}ms</p>
                        <p className="text-xs text-muted-foreground">{rpcResult.timestamp}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Audit Log Entries */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Admin Access Audit Trail
              </CardTitle>
            </CardHeader>
            <CardContent>
              {auditEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No admin access audit entries found</p>
              ) : (
                <div className="space-y-2">
                  {auditEntries.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center gap-3">
                        <Badge variant={entry.status === 'success' ? 'default' : 'destructive'}>
                          {entry.status}
                        </Badge>
                        <span className="text-sm font-medium">{entry.action}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(entry.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-4"
                onClick={fetchAuditEntries}
              >
                Refresh Audit Log
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminGuard>
  );
}