import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface SelfCheckData {
  user_id: string | null;
  email: string | null;
  project_url: string;
  anon_key_hash: string;
  in_superadmins_table: boolean;
  rpc_returns_true: boolean;
  sql_to_run?: string;
}

export function AdminSelfCheck() {
  const [checkData, setCheckData] = useState<SelfCheckData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const runSelfCheck = async () => {
    if (!user) {
      toast({
        title: "Not authenticated",
        description: "Please sign in to run the self-check",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Get current project config
      const project_url = import.meta.env.VITE_SUPABASE_URL || 'unknown';
      const anon_key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'unknown';
      const anon_key_hash = anon_key.substring(0, 20) + '...';

      // Check if user is in superadmins table
      const { data: superadminCheck, error: superadminError } = await supabase
        .from('superadmins')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (superadminError && superadminError.code !== 'PGRST116') {
        throw superadminError;
      }

      const in_superadmins_table = !!superadminCheck;

      // Test RPC function
      const { data: rpcResult, error: rpcError } = await supabase.rpc('is_superadmin', { 
        user_id: user.id 
      });

      if (rpcError) {
        throw rpcError;
      }

      const rpc_returns_true = Boolean(rpcResult);

      // Generate SQL if not in table
      const sql_to_run = !in_superadmins_table 
        ? `INSERT INTO public.superadmins (user_id) VALUES ('${user.id}');`
        : undefined;

      setCheckData({
        user_id: user.id,
        email: user.email || null,
        project_url,
        anon_key_hash,
        in_superadmins_table,
        rpc_returns_true,
        sql_to_run,
      });

      // Secure dev log (superadmin-only console)
      if (rpc_returns_true) {
        console.log('🔐 Admin Self-Check (SUPERADMIN ONLY):', {
          project_url,
          anon_key_hash,
          user_id: user.id,
          email: user.email,
          in_superadmins_table,
          rpc_returns_true,
          ts: new Date().toISOString()
        });
      }

    } catch (error) {
      console.error('Self-check failed:', error);
      toast({
        title: "Self-check failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runSelfCheck();
  }, [user]);

  if (!checkData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Admin Self-Check</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button onClick={runSelfCheck} disabled={isLoading}>
              {isLoading ? 'Running Check...' : 'Run Self-Check'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin Self-Check Results</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <strong>User ID:</strong>
              <p className="font-mono text-sm">{checkData.user_id}</p>
            </div>
            <div>
              <strong>Email:</strong>
              <p className="text-sm">{checkData.email}</p>
            </div>
            <div>
              <strong>Project URL:</strong>
              <p className="font-mono text-sm">{checkData.project_url}</p>
            </div>
            <div>
              <strong>Anon Key:</strong>
              <p className="font-mono text-sm">{checkData.anon_key_hash}</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <strong>In superadmins table:</strong>
              <Badge variant={checkData.in_superadmins_table ? "default" : "destructive"}>
                {checkData.in_superadmins_table ? 'YES' : 'NO'}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <strong>RPC returns true:</strong>
              <Badge variant={checkData.rpc_returns_true ? "default" : "destructive"}>
                {checkData.rpc_returns_true ? 'YES' : 'NO'}
              </Badge>
            </div>
          </div>

          {checkData.sql_to_run && (
            <div className="p-4 bg-muted rounded-lg">
              <strong>SQL to run manually:</strong>
              <pre className="mt-2 font-mono text-sm bg-background p-2 rounded border">
                {checkData.sql_to_run}
              </pre>
            </div>
          )}

          <Button onClick={runSelfCheck} disabled={isLoading} className="w-full">
            {isLoading ? 'Running...' : 'Re-run Check'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}