import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/AppSidebar"
import { DashboardOverview } from "@/components/dashboard/DashboardOverview"
import { CallsScreen } from "@/components/dashboard/CallsScreen"
import { AgentsScreen } from "@/components/dashboard/AgentsScreen"
import { KnowledgeBase } from "@/components/dashboard/KnowledgeBase"
import { Scheduling } from "@/components/dashboard/Scheduling"
import { UsageBilling } from "@/components/dashboard/UsageBilling"
import { useState } from "react"

const Dashboard = () => {
  const [activeScreen, setActiveScreen] = useState("overview")

  const renderContent = () => {
    switch (activeScreen) {
      case "overview":
        return <DashboardOverview />
      case "calls":
        return <CallsScreen />
      case "agents":
        return <AgentsScreen />
      case "knowledge":
        return <KnowledgeBase />
      case "scheduling":
        return <Scheduling />
      case "billing":
        return <UsageBilling />
      default:
        return <DashboardOverview />
    }
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar activeScreen={activeScreen} setActiveScreen={setActiveScreen} />
        
        <main className="flex-1">
          <header className="h-14 flex items-center border-b bg-background px-6">
            <SidebarTrigger />
            <div className="ml-4 flex-1">
              <h1 className="text-lg font-semibold capitalize">
                {activeScreen === "overview" ? "Dashboard" : activeScreen}
              </h1>
            </div>
          </header>
          
          <div className="p-6">
            {renderContent()}
          </div>
        </main>
      </div>
    </SidebarProvider>
  )
}

export default Dashboard