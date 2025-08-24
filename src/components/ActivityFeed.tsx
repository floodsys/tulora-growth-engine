import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Activity, 
  User, 
  Bot, 
  Phone, 
  Users, 
  Building2, 
  Calendar as CalendarIcon,
  Filter,
  RefreshCw,
  Search,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { useToast } from "@/hooks/use-toast";

interface ActivityLog {
  id: string;
  organization_id: string;
  user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: any;
  created_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

interface ActivityFeedProps {
  showFilters?: boolean;
  maxHeight?: string;
  compact?: boolean;
}

export function ActivityFeed({ showFilters = true, maxHeight = "h-96", compact = false }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const { organizationId } = useUserOrganization();
  const { toast } = useToast();

  const loadActivities = async () => {
    if (!organizationId) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from('activity_logs')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (filter !== 'all') {
        query = query.eq('action', filter);
      }

      if (dateRange.from) {
        query = query.gte('created_at', dateRange.from.toISOString());
      }

      if (dateRange.to) {
        query = query.lte('created_at', dateRange.to.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      // Filter by search term if provided
      let filteredData = (data || []) as ActivityLog[];
      if (searchTerm) {
        filteredData = filteredData.filter(activity => 
          activity.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
          activity.resource_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          JSON.stringify(activity.details).toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      setActivities(filteredData);
    } catch (error) {
      console.error('Error loading activities:', error);
      toast({
        title: "Error",
        description: "Failed to load activity feed",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, [organizationId, filter, dateRange]);

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      if (searchTerm !== '') {
        loadActivities();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const getActivityIcon = (action: string, resourceType: string | null) => {
    if (action.includes('user') || action.includes('login') || action.includes('profile')) {
      return <User className="h-4 w-4" />;
    }
    if (action.includes('agent')) {
      return <Bot className="h-4 w-4" />;
    }
    if (action.includes('call')) {
      return <Phone className="h-4 w-4" />;
    }
    if (action.includes('member') || action.includes('invite')) {
      return <Users className="h-4 w-4" />;
    }
    if (action.includes('organization')) {
      return <Building2 className="h-4 w-4" />;
    }
    if (action.includes('appointment')) {
      return <CalendarIcon className="h-4 w-4" />;
    }
    return <Activity className="h-4 w-4" />;
  };

  const getActivityVariant = (action: string) => {
    if (action.includes('created') || action.includes('completed') || action.includes('accepted')) {
      return "default";
    }
    if (action.includes('updated') || action.includes('activated')) {
      return "secondary";
    }
    if (action.includes('deleted') || action.includes('cancelled') || action.includes('failed')) {
      return "destructive";
    }
    return "outline";
  };

  const formatActivityMessage = (activity: ActivityLog) => {
    const action = activity.action.replace(/_/g, ' ');
    const resourceType = activity.resource_type || 'item';
    
    // Extract user name from details if available
    const userName = activity.details?.userName || activity.details?.name || 'User';
    
    return `${action.charAt(0).toUpperCase() + action.slice(1)} ${resourceType}${activity.details?.name ? ` "${activity.details.name}"` : ''}`;
  };

  const filterOptions = [
    { value: 'all', label: 'All Activities' },
    { value: 'user_login', label: 'User Logins' },
    { value: 'agent_created', label: 'Agent Created' },
    { value: 'call_initiated', label: 'Calls Initiated' },
    { value: 'member_invited', label: 'Members Invited' },
    { value: 'organization_updated', label: 'Org Updates' },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Activity Feed
            </CardTitle>
            <CardDescription>
              Recent activities and events in your organization
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadActivities}
            disabled={loading}
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {showFilters && (
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search activities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-48">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      `${format(dateRange.from, "MMM dd")} - ${format(dateRange.to, "MMM dd")}`
                    ) : (
                      format(dateRange.from, "MMM dd, yyyy")
                    )
                  ) : (
                    "Date range"
                  )}
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={dateRange.from && dateRange.to ? { from: dateRange.from, to: dateRange.to } : undefined}
                  onSelect={(range) => {
                    setDateRange(range || {});
                    if (range?.from && range?.to) {
                      setShowDatePicker(false);
                    }
                  }}
                  numberOfMonths={2}
                />
                <div className="p-3 border-t">
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                      setDateRange({});
                      setShowDatePicker(false);
                    }}
                  >
                    Clear dates
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}

        <ScrollArea className={maxHeight}>
          {activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Loading activities...
                </div>
              ) : (
                <div>
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No activities found
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((activity, index) => (
                <div key={activity.id}>
                  <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="mt-0.5">
                      {getActivityIcon(activity.action, activity.resource_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge 
                          variant={getActivityVariant(activity.action)}
                          className="text-xs"
                        >
                          {activity.action.replace(/_/g, ' ')}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(activity.created_at), 'MMM dd, HH:mm')}
                        </span>
                      </div>
                      <p className="text-sm font-medium">
                        {formatActivityMessage(activity)}
                      </p>
                      {activity.details && Object.keys(activity.details).length > 0 && !compact && (
                        <details className="text-xs mt-1">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            View details
                          </summary>
                          <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto">
                            {JSON.stringify(activity.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                  {index < activities.length - 1 && <Separator className="my-2" />}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}