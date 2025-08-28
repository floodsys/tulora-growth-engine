import { useState, useEffect } from "react";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Search, RefreshCw, Phone, Globe, PhoneCall } from "lucide-react";

interface CallLog {
  id: string;
  call_id: string;
  agent_id: string;
  direction: string;
  to_e164: string;
  from_e164: string;
  status: string;
  started_at: string;
  ended_at: string;
  transcript_url: string;
  created_at: string;
  agent_display_name?: string;
}

export default function AdminCalls() {
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [filteredCalls, setFilteredCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const { toast } = useToast();

  const fetchCalls = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('call_logs')
        .select(`
          *,
          voice_agents!call_logs_agent_id_fkey (
            display_name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      const enrichedCalls = data?.map(call => ({
        ...call,
        agent_display_name: call.voice_agents?.display_name || null
      })) || [];

      setCalls(enrichedCalls);
      setFilteredCalls(enrichedCalls);
    } catch (error) {
      console.error('Error fetching calls:', error);
      toast({
        title: "Error",
        description: "Failed to load call logs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls();
  }, []);

  useEffect(() => {
    let filtered = calls.filter(call =>
      call.call_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      call.to_e164?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      call.from_e164?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      call.agent_display_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (directionFilter !== "all") {
      filtered = filtered.filter(call => call.direction === directionFilter);
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(call => call.status === statusFilter);
    }

    setFilteredCalls(filtered);
  }, [searchTerm, directionFilter, statusFilter, calls]);

  const getDirectionIcon = (direction: string) => {
    switch (direction) {
      case 'inbound': return <Phone className="h-4 w-4" />;
      case 'outbound': return <PhoneCall className="h-4 w-4" />;
      case 'web': return <Globe className="h-4 w-4" />;
      default: return <Phone className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      completed: "default",
      in_progress: "secondary",
      failed: "destructive",
      cancelled: "outline",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const formatDuration = (startedAt: string, endedAt: string) => {
    if (!startedAt || !endedAt) return "—";
    const start = new Date(startedAt);
    const end = new Date(endedAt);
    const durationMs = end.getTime() - start.getTime();
    const seconds = Math.round(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <AdminGuard>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Call Logs</CardTitle>
                  <CardDescription>
                    Monitor and review voice call activity across all agents
                  </CardDescription>
                </div>
                <Button
                  onClick={fetchCalls}
                  disabled={loading}
                  size="sm"
                  variant="outline"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              <div className="space-y-4">
                {/* Search and Filters */}
                <div className="flex items-center space-x-2">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search calls..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  
                  <Select value={directionFilter} onValueChange={setDirectionFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Direction" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="inbound">Inbound</SelectItem>
                      <SelectItem value="outbound">Outbound</SelectItem>
                      <SelectItem value="web">Web</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="text-sm text-muted-foreground">
                    {filteredCalls.length} of {calls.length} calls
                  </div>
                </div>

                {/* Table */}
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Call ID</TableHead>
                        <TableHead>Agent</TableHead>
                        <TableHead>Direction</TableHead>
                        <TableHead>To</TableHead>
                        <TableHead>From</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Started</TableHead>
                        <TableHead>Transcript</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8">
                            Loading calls...
                          </TableCell>
                        </TableRow>
                      ) : filteredCalls.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                            No calls found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredCalls.map((call) => (
                          <TableRow key={call.id}>
                            <TableCell className="font-mono text-sm">
                              {call.call_id?.substring(0, 8)}...
                            </TableCell>
                            <TableCell>
                              {call.agent_display_name || 
                                (call.agent_id ? call.agent_id.substring(0, 8) + "..." : "—")
                              }
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                {getDirectionIcon(call.direction)}
                                <span className="capitalize">{call.direction}</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {call.to_e164 || "—"}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {call.from_e164 || "—"}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(call.status)}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {formatDuration(call.started_at, call.ended_at)}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {call.started_at ? 
                                new Date(call.started_at).toLocaleString() : "—"
                              }
                            </TableCell>
                            <TableCell>
                              {call.transcript_url ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => window.open(call.transcript_url, '_blank')}
                                >
                                  View
                                </Button>
                              ) : "—"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminGuard>
  );
}