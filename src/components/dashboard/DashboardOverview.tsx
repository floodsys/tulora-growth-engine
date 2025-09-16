import { useState, useEffect } from "react"
import { KpiCard } from "./widgets/KpiCard"
import { TrendLine } from "./widgets/TrendLine"
import { BarBySource } from "./widgets/BarBySource"
import { RecentCallsTable } from "./widgets/RecentCallsTable"
import { DateRangePicker } from "./widgets/DateRangePicker"
import { ActivityFeed } from "@/components/ActivityFeed"
import { ManualAccessBannerContainer } from "@/components/ui/ManualAccessBannerContainer"
import { useRetellAnalytics } from "@/hooks/useRetellAnalytics"
import { useRetellCalls } from "@/hooks/useRetellCalls"
import { useUserOrganization } from "@/hooks/useUserOrganization"
import { useDashboardDateRange } from "@/hooks/useDashboardDateRange"
import { DateRange } from "react-day-picker"
import { Users, Phone, Calendar, Star, Bot, TrendingUp } from "lucide-react"
import { useEntitlements } from "@/lib/entitlements/ssot"

// Mock data
const kpiData = {
  newLeads: { value: 142, change: { value: 12, isPositive: true } },
  callsPlaced: { value: 89, change: { value: 8, isPositive: true } },
  meetingsBooked: { value: 23, change: { value: 15, isPositive: true } },
  csat: { value: "4.2", change: { value: 5, isPositive: true } }
}

const trendData = [
  { date: "Jan 1", value: 12 },
  { date: "Jan 2", value: 19 },
  { date: "Jan 3", value: 15 },
  { date: "Jan 4", value: 22 },
  { date: "Jan 5", value: 18 },
  { date: "Jan 6", value: 25 },
  { date: "Jan 7", value: 21 }
]

const sourceData = [
  { source: "LinkedIn", leads: 45 },
  { source: "Email", leads: 32 },
  { source: "Cold Call", leads: 28 },
  { source: "Referral", leads: 18 },
  { source: "Website", leads: 12 }
]

const recentCalls = [
  {
    id: "1",
    caller: "John Smith",
    outcome: "Interested",
    sentiment: "positive" as const,
    duration: 180,
    owner: "Sarah J.",
    timestamp: new Date(Date.now() - 1000 * 60 * 30)
  },
  {
    id: "2", 
    caller: "Jane Doe",
    outcome: "Not Interested",
    sentiment: "negative" as const,
    duration: 45,
    owner: "Mike R.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60)
  },
  {
    id: "3",
    caller: "Bob Wilson", 
    outcome: "Follow Up",
    sentiment: "neutral" as const,
    duration: 120,
    owner: "Lisa K.",
    timestamp: new Date(Date.now() - 1000 * 60 * 90)
  }
]

export function DashboardOverview() {
  const { dateRange, setDateRange } = useDashboardDateRange()
  const [loading, setLoading] = useState(false)
  const [kpis, setKpis] = useState<any>(null)
  
  const { organization } = useUserOrganization()
  const { getKpis } = useRetellAnalytics(organization?.id)
  const { calls, getCallStats } = useRetellCalls(organization?.id)
  const { entitlements } = useEntitlements(organization?.id)

  // Load KPIs when date range changes
  useEffect(() => {
    const loadKpis = async () => {
      if (!organization?.id) return
      
      setLoading(true)
      try {
        const dateFilter = dateRange?.from && dateRange?.to ? {
          start: dateRange.from.toISOString(),
          end: dateRange.to.toISOString()
        } : undefined

        const kpiData = await getKpis(dateFilter)
        setKpis(kpiData)
      } catch (error) {
        console.error('Error loading KPIs:', error)
      } finally {
        setLoading(false)
      }
    }

    loadKpis()
  }, [dateRange, organization?.id, getKpis])

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header with Date Range Picker */}
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
        <div>
          <h2 className="text-xl md:text-2xl font-bold">Dashboard Overview</h2>
          <p className="text-sm md:text-base text-muted-foreground">
            Track your outreach performance and results
          </p>
        </div>
        <div className="w-full md:w-auto">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {/* Manual Access Banner */}
      <ManualAccessBannerContainer />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <KpiCard
          title="Total Calls"
          value={kpis?.totalCalls || 0}
          change={{ value: 0, isPositive: true }}
          icon={Phone}
          loading={loading}
        />
        <KpiCard
          title="Completed Calls"
          value={kpis?.completedCalls || 0}
          change={{ value: 0, isPositive: true }}
          icon={Calendar}
          loading={loading}
        />
        <KpiCard
          title="Avg Duration"
          value={`${kpis?.avgDurationMinutes || 0}m`}
          change={{ value: 0, isPositive: true }}
          icon={Star}
          loading={loading}
        />
        <KpiCard
          title="Active Agents"
          value={kpis?.activeAgents || 0}
          change={{ value: 0, isPositive: true }}
          icon={Bot}
          loading={loading}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
        {entitlements.features.advancedAnalytics ? (
          <>
            <TrendLine
              title="Conversions Over Time"
              data={trendData}
              loading={loading}
            />
            <BarBySource
              title="Leads by Source"
              data={sourceData}
              loading={loading}
            />
          </>
        ) : (
          <div className="xl:col-span-2">
            <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
              <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Advanced Analytics</h3>
              <p className="text-muted-foreground mb-4">
                Unlock detailed charts and insights with a Business plan or higher.
              </p>
              <p className="text-sm text-muted-foreground">
                Available on Business+
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Row: Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentCallsTable
            calls={calls.slice(0, 5).map(call => ({
              id: call.id,
              caller: call.from_e164 || 'Unknown',
              outcome: call.outcome || 'Unknown',
              sentiment: (call.sentiment === 'mixed' ? 'neutral' : call.sentiment) || 'neutral',
              duration: Math.round((call.duration_ms || 0) / 1000),
              owner: 'Agent',
              timestamp: new Date(call.started_at || call.created_at)
            }))}
            loading={loading}
            onCallSelect={(call) => console.log("View call:", call)}
            onRedial={(call) => console.log("Redial:", call)}
          />
        </div>
        <div>
          <ActivityFeed showFilters={false} maxHeight="h-80" compact={true} />
        </div>
      </div>
    </div>
  )
}