import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CheckCircle, XCircle, AlertTriangle, Clock, RefreshCw, FileText, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TestLog {
  id: string;
  test_session_id: string;
  organization_id: string;
  test_type: string;
  test_suite: string;
  test_name: string;
  status: string;
  message: string | null;
  details: any;
  duration_ms: number | null;
  user_id: string;
  created_at: string;
  environment: string;
  git_commit: string | null;
  test_runner: string;
}

interface TestSession {
  sessionId: string;
  logs: TestLog[];
  startTime: string;
  endTime: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  testType: string;
}

interface TestLogViewerProps {
  organizationId: string;
}

export function TestLogViewer({ organizationId }: TestLogViewerProps) {
  const [sessions, setSessions] = useState<TestSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'smoke' | 'full'>('all');
  const [selectedSession, setSelectedSession] = useState<TestSession | null>(null);
  const { toast } = useToast();

  const loadTestLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('test_logs')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('test_type', filter);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      // Group logs by session
      const sessionMap = new Map<string, TestLog[]>();
      data?.forEach(log => {
        const sessionId = log.test_session_id;
        if (!sessionMap.has(sessionId)) {
          sessionMap.set(sessionId, []);
        }
        sessionMap.get(sessionId)!.push(log);
      });

      // Convert to session objects
      const sessionList: TestSession[] = Array.from(sessionMap.entries()).map(([sessionId, logs]) => {
        const sortedLogs = logs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const passedTests = logs.filter(l => l.status === 'passed').length;
        const failedTests = logs.filter(l => l.status === 'failed' || l.status === 'error').length;
        
        return {
          sessionId,
          logs: sortedLogs,
          startTime: sortedLogs[0]?.created_at || '',
          endTime: sortedLogs[sortedLogs.length - 1]?.created_at || '',
          totalTests: logs.length,
          passedTests,
          failedTests,
          testType: sortedLogs[0]?.test_type || 'smoke'
        };
      });

      setSessions(sessionList.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()));
    } catch (error) {
      console.error('Error loading test logs:', error);
      toast({
        title: "Error",
        description: "Failed to load test logs",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTestLogs();
  }, [organizationId, filter]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSessionStatus = (session: TestSession) => {
    if (session.failedTests > 0) {
      return { variant: "destructive" as const, text: "Failed" };
    }
    return { variant: "default" as const, text: "Passed" };
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Test Execution History
            </CardTitle>
            <CardDescription>
              Internal test logs and outcomes (excluded from customer analytics)
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={(value: 'all' | 'smoke' | 'full') => setFilter(value)}>
              <SelectTrigger className="w-32">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tests</SelectItem>
                <SelectItem value="smoke">Smoke</SelectItem>
                <SelectItem value="full">Full Suite</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadTestLogs}
              disabled={loading}
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No test sessions found
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => {
                const status = getSessionStatus(session);
                return (
                  <Dialog key={session.sessionId}>
                    <DialogTrigger asChild>
                      <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Badge variant={status.variant}>
                                {status.text}
                              </Badge>
                              <Badge variant="outline">
                                {session.testType.toUpperCase()}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {new Date(session.startTime).toLocaleString()}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <span className="flex items-center gap-1">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                {session.passedTests}
                              </span>
                              <span className="flex items-center gap-1">
                                <XCircle className="h-4 w-4 text-red-500" />
                                {session.failedTests}
                              </span>
                              <span>{session.totalTests} total</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[80vh]">
                      <DialogHeader>
                        <DialogTitle>Test Session Details</DialogTitle>
                        <DialogDescription>
                          Session: {session.sessionId} • {session.testType.toUpperCase()} • {new Date(session.startTime).toLocaleString()}
                        </DialogDescription>
                      </DialogHeader>
                      <ScrollArea className="h-96">
                        <div className="space-y-2">
                          {session.logs.map((log, index) => (
                            <div key={log.id}>
                              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                                <div className="mt-0.5">
                                  {getStatusIcon(log.status)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="outline" className="text-xs">
                                      {log.test_suite}
                                    </Badge>
                                    <span className="font-medium text-sm">{log.test_name}</span>
                                    {log.duration_ms && (
                                      <span className="text-xs text-muted-foreground">
                                        {log.duration_ms}ms
                                      </span>
                                    )}
                                  </div>
                                  {log.message && (
                                    <p className="text-sm text-muted-foreground mb-2">{log.message}</p>
                                  )}
                                  {log.details && Object.keys(log.details).length > 0 && (
                                    <details className="text-xs">
                                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                        Show details
                                      </summary>
                                      <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                                        {JSON.stringify(log.details, null, 2)}
                                      </pre>
                                    </details>
                                  )}
                                </div>
                              </div>
                              {index < session.logs.length - 1 && <Separator className="my-2" />}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </DialogContent>
                  </Dialog>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}