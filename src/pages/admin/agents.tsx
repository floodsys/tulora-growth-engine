import { useState, useEffect } from "react";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Search, RefreshCw } from "lucide-react";

interface VoiceAgent {
  id: string;
  slug: string;
  display_name: string;
  description: string;
  retell_agent_id: string;
  from_number: string;
  use_case_tags: string[];
  booking_provider: string;
  booking_config: any;
  prompt: string;
  created_at: string;
}

export default function AdminAgents() {
  const [agents, setAgents] = useState<VoiceAgent[]>([]);
  const [filteredAgents, setFilteredAgents] = useState<VoiceAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('voice_agents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setAgents(data || []);
      setFilteredAgents(data || []);
    } catch (error) {
      console.error('Error fetching agents:', error);
      toast({
        title: "Error",
        description: "Failed to load voice agents",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  useEffect(() => {
    const filtered = agents.filter(agent =>
      agent.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredAgents(filtered);
  }, [searchTerm, agents]);

  const truncateText = (text: string, maxLength: number = 50) => {
    if (!text) return "—";
    return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
  };

  return (
    <AdminGuard>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Voice Agents</CardTitle>
                  <CardDescription>
                    Manage and monitor AI voice agents in the system
                  </CardDescription>
                </div>
                <Button
                  onClick={fetchAgents}
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
                      placeholder="Search agents..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {filteredAgents.length} of {agents.length} agents
                  </div>
                </div>

                {/* Table */}
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Slug</TableHead>
                        <TableHead>Display Name</TableHead>
                        <TableHead>Retell Agent ID</TableHead>
                        <TableHead>From Number</TableHead>
                        <TableHead>Use Case Tags</TableHead>
                        <TableHead>Booking Config</TableHead>
                        <TableHead>Prompt</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8">
                            Loading agents...
                          </TableCell>
                        </TableRow>
                      ) : filteredAgents.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                            No agents found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAgents.map((agent) => (
                          <TableRow key={agent.id}>
                            <TableCell className="font-mono text-sm">
                              {agent.slug}
                            </TableCell>
                            <TableCell className="font-medium">
                              {agent.display_name}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {truncateText(agent.retell_agent_id, 20)}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {agent.from_number || "—"}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {agent.use_case_tags?.map((tag, index) => (
                                  <Badge key={index} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                )) || "—"}
                              </div>
                            </TableCell>
                            <TableCell>
                              {agent.booking_config ? (
                                <div className="text-sm text-muted-foreground">
                                  {agent.booking_provider}: {agent.booking_config.eventTypeId}
                                </div>
                              ) : "—"}
                            </TableCell>
                            <TableCell className="max-w-xs">
                              <div className="text-sm" title={agent.prompt}>
                                {truncateText(agent.prompt, 40)}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(agent.created_at).toLocaleDateString()}
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