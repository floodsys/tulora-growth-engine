import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DateRangePicker } from "@/components/dashboard/widgets/DateRangePicker"
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Bot, 
  CreditCard, 
  Phone, 
  UserCheck, 
  Calendar,
  Target,
  Clock,
  CheckCircle,
  AlertTriangle,
  Download,
  Filter,
  Building
} from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "@/hooks/use-toast"

interface AnalyticsData {
  // Global metrics
  totalOrgs: number
  activeOrgs: number
  totalAgents: number
  activeAgents: number
  totalSeats: number
  monthlyRecurringRevenue: number
  churnRisk: number
  
  // Lead Gen metrics
  leadGenCalls: number
  leadGenConnects: number
  qualifiedLeads: number
  bookedMeetings: number
  conversionRate: number
  
  // AI Customer Service metrics
  supportCalls: number
  avgHandleTime: number
  firstCallResolution: number
  deflectionRate: number
  csatScore: number
  escalationRate: number
  
  // Health metrics
  errorRate: number
  webhookFailures: number
  inviteSuccessRate: number
}

interface OrgAnalytics extends AnalyticsData {
  organizationId: string
  organizationName: string
  planLimits: {
    agents: number
    seats: number
    callsPerMonth: number
  }
  usage: {
    agents: number
    seats: number
    callsThisMonth: number
  }
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1']

export function AnalyticsDashboard() {
  const [globalData, setGlobalData] = useState<AnalyticsData | null>(null)
  const [orgData, setOrgData] = useState<OrgAnalytics[]>([])
  const [selectedOrg, setSelectedOrg] = useState<string>('global')
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    to: new Date()
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadAnalyticsData()
  }, [dateRange])

  const loadAnalyticsData = async () => {
    setIsLoading(true)
    try {
      // Mock data for now - in real implementation, this would call analytics functions
      const mockGlobalData: AnalyticsData = {
        totalOrgs: 156,
        activeOrgs: 143,
        totalAgents: 892,
        activeAgents: 734,
        totalSeats: 2847,
        monthlyRecurringRevenue: 89430,
        churnRisk: 12,
        leadGenCalls: 15420,
        leadGenConnects: 12330,
        qualifiedLeads: 3890,
        bookedMeetings: 1250,
        conversionRate: 32.1,
        supportCalls: 28940,
        avgHandleTime: 285,
        firstCallResolution: 78.5,
        deflectionRate: 65.2,
        csatScore: 4.2,
        escalationRate: 8.3,
        errorRate: 1.2,
        webhookFailures: 23,
        inviteSuccessRate: 94.5
      }

      setGlobalData(mockGlobalData)

      // Mock org data
      const mockOrgData: OrgAnalytics[] = [
        {
          ...mockGlobalData,
          organizationId: 'org-1',
          organizationName: 'Acme Corp',
          planLimits: { agents: 10, seats: 50, callsPerMonth: 5000 },
          usage: { agents: 8, seats: 35, callsThisMonth: 3240 },
          totalOrgs: 1,
          activeOrgs: 1,
          totalAgents: 8,
          activeAgents: 7,
          totalSeats: 35,
          leadGenCalls: 1240,
          supportCalls: 2000
        }
      ]

      setOrgData(mockOrgData)
    } catch (error: any) {
      toast({
        title: "Error loading analytics",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const exportToCSV = () => {
    const data = selectedOrg === 'global' ? globalData : orgData.find(o => o.organizationId === selectedOrg)
    if (!data) return

    const csvContent = Object.entries(data)
      .map(([key, value]) => `${key},${value}`)
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analytics-${selectedOrg}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const currentData = selectedOrg === 'global' ? globalData : orgData.find(o => o.organizationId === selectedOrg)

  if (isLoading || !currentData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading analytics...</p>
        </div>
      </div>
    )
  }

  const isOrgView = selectedOrg !== 'global'
  const orgAnalytics = isOrgView ? currentData as OrgAnalytics : null

  const businessMetrics = [
    { title: "Active Organizations", value: currentData.activeOrgs, total: currentData.totalOrgs, icon: Building, color: "text-blue-600" },
    { title: "Active AI Agents", value: currentData.activeAgents, total: currentData.totalAgents, icon: Bot, color: "text-purple-600" },
    { title: "Total Seats", value: currentData.totalSeats, icon: Users, color: "text-green-600" },
    { title: "Monthly Recurring Revenue", value: `$${(currentData.monthlyRecurringRevenue / 100).toLocaleString()}`, icon: CreditCard, color: "text-emerald-600" }
  ]

  const leadGenMetrics = [
    { title: "Total Calls", value: currentData.leadGenCalls.toLocaleString(), icon: Phone },
    { title: "Successful Connects", value: currentData.leadGenConnects.toLocaleString(), icon: UserCheck },
    { title: "Qualified Leads", value: currentData.qualifiedLeads.toLocaleString(), icon: Target },
    { title: "Booked Meetings", value: currentData.bookedMeetings.toLocaleString(), icon: Calendar },
    { title: "Conversion Rate", value: `${currentData.conversionRate}%`, icon: TrendingUp }
  ]

  const supportMetrics = [
    { title: "Support Calls", value: currentData.supportCalls.toLocaleString(), icon: Phone },
    { title: "Avg Handle Time", value: `${Math.floor(currentData.avgHandleTime / 60)}:${(currentData.avgHandleTime % 60).toString().padStart(2, '0')}`, icon: Clock },
    { title: "First Call Resolution", value: `${currentData.firstCallResolution}%`, icon: CheckCircle },
    { title: "CSAT Score", value: `${currentData.csatScore}/5.0`, icon: TrendingUp },
    { title: "Escalation Rate", value: `${currentData.escalationRate}%`, icon: AlertTriangle }
  ]

  // Mock chart data
  const callsTrendData = [
    { date: '2024-01', leadGen: 1200, support: 2800 },
    { date: '2024-02', leadGen: 1350, support: 2950 },
    { date: '2024-03', leadGen: 1180, support: 3100 },
    { date: '2024-04', leadGen: 1420, support: 2890 },
    { date: '2024-05', leadGen: 1540, support: 2940 }
  ]

  const conversionFunnelData = [
    { name: 'Calls Made', value: currentData.leadGenCalls, fill: COLORS[0] },
    { name: 'Connects', value: currentData.leadGenConnects, fill: COLORS[1] },
    { name: 'Qualified', value: currentData.qualifiedLeads, fill: COLORS[2] },
    { name: 'Meetings', value: currentData.bookedMeetings, fill: COLORS[3] }
  ]

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
          <p className="text-muted-foreground">
            {isOrgView ? `Analytics for ${orgAnalytics?.organizationName}` : 'Global system analytics'}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={selectedOrg} onValueChange={setSelectedOrg}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="global">Global Analytics</SelectItem>
              {orgData.map(org => (
                <SelectItem key={org.organizationId} value={org.organizationId}>
                  {org.organizationName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          
          <DateRangePicker
            value={{ from: dateRange.from, to: dateRange.to }}
            onChange={(range) => setDateRange({ 
              from: range?.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 
              to: range?.to || new Date() 
            })}
          />
          
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Plan Usage Warnings for Org View */}
      {isOrgView && orgAnalytics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {orgAnalytics.usage.agents / orgAnalytics.planLimits.agents > 0.8 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Agent Limit Warning</p>
                    <p className="text-xs text-muted-foreground">
                      {orgAnalytics.usage.agents}/{orgAnalytics.planLimits.agents} agents used
                    </p>
                  </div>
                  <Button size="sm" variant="outline">Upgrade Plan</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Business Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {businessMetrics.map((metric, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
              <metric.icon className={`h-4 w-4 ${metric.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              {metric.total && (
                <p className="text-xs text-muted-foreground">
                  of {metric.total} total
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Agent Type Analytics */}
      <Tabs defaultValue="leadgen" className="space-y-4">
        <TabsList>
          <TabsTrigger value="leadgen">AI Lead Generation</TabsTrigger>
          <TabsTrigger value="support">AI Customer Service</TabsTrigger>
          <TabsTrigger value="health">System Health</TabsTrigger>
        </TabsList>

        <TabsContent value="leadgen" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {leadGenMetrics.map((metric, index) => (
              <Card key={index}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
                  <metric.icon className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metric.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Lead Generation Funnel</CardTitle>
                <CardDescription>Conversion rates through the funnel</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={conversionFunnelData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Calls Trend</CardTitle>
                <CardDescription>Monthly call volume trends</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={callsTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="leadGen" stroke="#8884d8" name="Lead Gen" />
                    <Line type="monotone" dataKey="support" stroke="#82ca9d" name="Support" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="support" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {supportMetrics.map((metric, index) => (
              <Card key={index}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
                  <metric.icon className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metric.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Resolution Metrics</CardTitle>
                <CardDescription>Call resolution effectiveness</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'First Call Resolution', value: currentData.firstCallResolution },
                        { name: 'Multi-Call Resolution', value: 100 - currentData.firstCallResolution }
                      ]}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                    >
                      {[
                        <Cell key={0} fill={COLORS[0]} />,
                        <Cell key={1} fill={COLORS[1]} />
                      ]}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Handle Time Distribution</CardTitle>
                <CardDescription>Average time per call by category</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[
                    { category: 'Quick (<2min)', time: 85 },
                    { category: 'Standard (2-5min)', time: 195 },
                    { category: 'Complex (5-10min)', time: 435 },
                    { category: 'Extended (10min+)', time: 680 }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="time" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{currentData.errorRate}%</div>
                <div className="text-xs text-muted-foreground">System-wide error rate</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Webhook Failures</CardTitle>
                <AlertTriangle className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{currentData.webhookFailures}</div>
                <div className="text-xs text-muted-foreground">Failed webhook deliveries</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Invite Success Rate</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{currentData.inviteSuccessRate}%</div>
                <div className="text-xs text-muted-foreground">Successful invitations</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}