import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/AppSidebar"
import { DashboardOverview } from "@/components/dashboard/DashboardOverview"
import { CallsScreen } from "@/components/dashboard/CallsScreen"
import { AgentsScreen } from "@/components/dashboard/AgentsScreen"
import { NumbersView } from "@/components/NumbersView"
import SMSView from "@/components/SMSView"
import { KnowledgeBase } from "@/components/dashboard/KnowledgeBase"
import { Scheduling } from "@/components/dashboard/Scheduling"
import { UsageBilling } from "@/components/dashboard/UsageBilling"
import { TeamManagement } from "@/components/dashboard/TeamManagement"
import { ProfileEditModal } from "@/components/ProfileEditModal"
import ChatWidget from "@/pages/ChatWidget"
import AbusePreventionSettings from "@/pages/AbusePrevention"
import AccessControl from "@/pages/AccessControl"
import OnboardingOrganization from "@/pages/OnboardingOrganization"

import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { useUserOrganization } from "@/hooks/useUserOrganization"

const Dashboard = () => {
  const [activeScreen, setActiveScreen] = useState("overview")
  const { toast } = useToast()
  const { organizationId } = useUserOrganization()

  // Handle checkout success/cancel redirects and tab parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const checkoutSuccess = urlParams.get('checkout_success')
    const checkoutCanceled = urlParams.get('checkout_canceled')
    const sessionId = urlParams.get('session_id')
    const tab = urlParams.get('tab')

    if (checkoutSuccess) {
      // Switch to billing screen and show success message
      setActiveScreen('billing')
      toast({
        title: "Checkout successful!",
        description: sessionId ? `Session ID: ${sessionId}` : "Your subscription is now active.",
      })
      
      // Clean up URL parameters
      window.history.replaceState({}, '', '/dashboard')
    } else if (checkoutCanceled) {
      // Switch to billing screen and show cancellation message
      setActiveScreen('billing')
      toast({
        title: "Checkout canceled",
        description: "You can try again anytime.",
        variant: "destructive",
      })
      
      // Clean up URL parameters
      window.history.replaceState({}, '', '/dashboard')
    } else if (tab) {
      // Set active screen based on tab parameter
      setActiveScreen(tab)
      // Clean up URL parameters
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [])

  const renderContent = () => {
    switch (activeScreen) {
      case "overview":
        return <DashboardOverview />
      case "calls":
        return <CallsScreen />
      case "agents":
        return <AgentsScreen />
      case "numbers":
        return <NumbersView />
      case "knowledge":
        return <KnowledgeBase />
      case "scheduling":
        return <Scheduling />
      case "billing":
        return <UsageBilling organizationId={organizationId || ""} />
      case "chat-widget":
        return <ChatWidget />
      case "abuse-prevention":
        return <AbusePreventionSettings />
      case "access-control":
        return <AccessControl />
      case "organization":
        return <TeamManagement />
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
                {activeScreen === "overview" ? "Dashboard" : 
                 activeScreen === "settings" ? "Settings" :
                 activeScreen}
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