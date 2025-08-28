import { useState, useEffect } from "react";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Search, RefreshCw, ExternalLink, Calendar, Phone, Mail } from "lucide-react";

interface Booking {
  id: string;
  agent_id: string;
  cal_booking_id: string;
  attendee_name: string;
  attendee_phone: string;
  attendee_email: string;
  time_start: string;
  time_end: string;
  payload: any;
  created_at: string;
  agent_display_name?: string;
}

export default function AdminBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          voice_agents!bookings_agent_id_fkey (
            display_name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      const enrichedBookings = data?.map(booking => ({
        ...booking,
        agent_display_name: booking.voice_agents?.display_name || null
      })) || [];

      setBookings(enrichedBookings);
      setFilteredBookings(enrichedBookings);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast({
        title: "Error",
        description: "Failed to load bookings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  useEffect(() => {
    const filtered = bookings.filter(booking =>
      booking.attendee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.attendee_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.attendee_phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.agent_display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.cal_booking_id?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredBookings(filtered);
  }, [searchTerm, bookings]);

  const formatDuration = (start: string, end: string) => {
    if (!start || !end) return "—";
    const startDate = new Date(start);
    const endDate = new Date(end);
    const durationMs = endDate.getTime() - startDate.getTime();
    const minutes = Math.round(durationMs / 1000 / 60);
    return `${minutes}m`;
  };

  const getBookingStatus = (timeStart: string) => {
    if (!timeStart) return "unknown";
    const now = new Date();
    const startTime = new Date(timeStart);
    
    if (startTime > now) return "upcoming";
    if (startTime.toDateString() === now.toDateString()) return "today";
    return "past";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "upcoming": return "text-blue-600 dark:text-blue-400";
      case "today": return "text-green-600 dark:text-green-400";
      case "past": return "text-muted-foreground";
      default: return "text-muted-foreground";
    }
  };

  return (
    <AdminGuard>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Bookings</CardTitle>
                  <CardDescription>
                    Monitor and review appointment bookings created by voice agents
                  </CardDescription>
                </div>
                <Button
                  onClick={fetchBookings}
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
                      placeholder="Search bookings..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {filteredBookings.length} of {bookings.length} bookings
                  </div>
                </div>

                {/* Table */}
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Attendee</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Agent</TableHead>
                        <TableHead>Appointment Time</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Cal.com ID</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8">
                            Loading bookings...
                          </TableCell>
                        </TableRow>
                      ) : filteredBookings.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                            No bookings found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredBookings.map((booking) => {
                          const status = getBookingStatus(booking.time_start);
                          return (
                            <TableRow key={booking.id}>
                              <TableCell className="font-medium">
                                {booking.attendee_name || "—"}
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  {booking.attendee_email && (
                                    <div className="flex items-center space-x-1 text-sm">
                                      <Mail className="h-3 w-3" />
                                      <span>{booking.attendee_email}</span>
                                    </div>
                                  )}
                                  {booking.attendee_phone && (
                                    <div className="flex items-center space-x-1 text-sm">
                                      <Phone className="h-3 w-3" />
                                      <span>{booking.attendee_phone}</span>
                                    </div>
                                  )}
                                  {!booking.attendee_email && !booking.attendee_phone && "—"}
                                </div>
                              </TableCell>
                              <TableCell>
                                {booking.agent_display_name || 
                                  (booking.agent_id ? booking.agent_id.substring(0, 8) + "..." : "—")
                                }
                              </TableCell>
                              <TableCell>
                                {booking.time_start ? (
                                  <div className="space-y-1">
                                    <div className="flex items-center space-x-1 text-sm">
                                      <Calendar className="h-3 w-3" />
                                      <span>{new Date(booking.time_start).toLocaleDateString()}</span>
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      {new Date(booking.time_start).toLocaleTimeString([], { 
                                        hour: '2-digit', 
                                        minute: '2-digit' 
                                      })}
                                    </div>
                                  </div>
                                ) : "—"}
                              </TableCell>
                              <TableCell className="text-sm">
                                {formatDuration(booking.time_start, booking.time_end)}
                              </TableCell>
                              <TableCell>
                                <span className={`text-sm font-medium capitalize ${getStatusColor(status)}`}>
                                  {status}
                                </span>
                              </TableCell>
                              <TableCell>
                                {booking.cal_booking_id ? (
                                  <div className="flex items-center space-x-2">
                                    <span className="font-mono text-sm">
                                      {booking.cal_booking_id.substring(0, 8)}...
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        // You could open Cal.com booking URL here if available
                                        navigator.clipboard.writeText(booking.cal_booking_id);
                                        toast({
                                          title: "Copied",
                                          description: "Booking ID copied to clipboard",
                                        });
                                      }}
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : "—"}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {new Date(booking.created_at).toLocaleDateString()}
                              </TableCell>
                            </TableRow>
                          );
                        })
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