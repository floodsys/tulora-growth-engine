import { useState } from "react"
import { KpiCard } from "./widgets/KpiCard"
import { TrendLine } from "./widgets/TrendLine"
import { BarBySource } from "./widgets/BarBySource"
import { RecentCallsTable } from "./widgets/RecentCallsTable"
import { DateRangePicker } from "./widgets/DateRangePicker"
import { DateRange } from "react-day-picker"
import { Users, Phone, Calendar, Star } from "lucide-react"

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
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [loading, setLoading] = useState(false)

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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <KpiCard
          title="New Leads"
          value={kpiData.newLeads.value}
          change={kpiData.newLeads.change}
          icon={Users}
          loading={loading}
        />
        <KpiCard
          title="Calls Placed"
          value={kpiData.callsPlaced.value}
          change={kpiData.callsPlaced.change}
          icon={Phone}
          loading={loading}
        />
        <KpiCard
          title="Meetings Booked"
          value={kpiData.meetingsBooked.value}
          change={kpiData.meetingsBooked.change}
          icon={Calendar}
          loading={loading}
        />
        <KpiCard
          title="CSAT Score"
          value={kpiData.csat.value}
          change={kpiData.csat.change}
          icon={Star}
          loading={loading}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">{/* ... keep existing code */}
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
      </div>

      {/* Recent Calls Table */}
      <RecentCallsTable
        calls={recentCalls}
        loading={loading}
        onCallSelect={(call) => console.log("View call:", call)}
        onRedial={(call) => console.log("Redial:", call)}
      />
    </div>
  )
}