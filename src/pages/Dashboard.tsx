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
        
        <main className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b bg-background px-4 md:px-6">
            <SidebarTrigger />
            <div className="ml-4 flex-1 min-w-0">
              <h1 className="text-lg font-semibold capitalize truncate">
                {activeScreen === "overview" ? "Dashboard" : activeScreen}
              </h1>
            </div>
          </header>
          
          <div className="flex-1 p-4 md:p-6 overflow-auto">
            {renderContent()}
          </div>
        </main>
      </div>
    </SidebarProvider>
  )
}

export default Dashboard