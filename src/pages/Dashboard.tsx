import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/AppSidebar"
import { DashboardOverview } from "@/components/dashboard/DashboardOverview"
import { CallsScreen } from "@/components/dashboard/CallsScreen"
import { AgentsScreen } from "@/components/dashboard/AgentsScreen"
import { AiWorkersScreen } from "@/components/dashboard/AiWorkersScreen"
import { NumbersManagement } from "@/components/dashboard/NumbersManagement"
import { WidgetManagement } from "@/components/dashboard/WidgetManagement"
import { AbusePreventionSettings } from "@/components/dashboard/AbusePreventionSettings"
import { AccessControlSettings } from "@/components/dashboard/AccessControlSettings"
import SMSView from "@/components/SMSView"
import { KnowledgeBase } from "@/components/dashboard/KnowledgeBase"
import { Scheduling } from "@/components/dashboard/Scheduling"
import { UsageBilling } from "@/components/dashboard/UsageBilling"
import { TeamManagement } from "@/components/dashboard/TeamManagement"
import { UnifiedSettings } from "@/components/UnifiedSettings"
import { ProfileSettingsScreen } from "@/components/dashboard/ProfileSettingsScreen"
import { ProfileEditModal } from "@/components/ProfileEditModal"
import SettingsTeams from "@/pages/SettingsTeams"
import SettingsOrganization from "@/pages/SettingsOrganization"

import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { useUserOrganization } from "@/hooks/useUserOrganization"
import { useEntitlements } from "@/lib/entitlements/ssot"

const Dashboard = () => {
  const [activeScreen, setActiveScreen] = useState("agents")
  const { toast } = useToast()
  const { organizationId, loading: orgLoading } = useUserOrganization()
  const { entitlements, refresh: refreshEntitlements } = useEntitlements(organizationId)

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
      
      // Refresh entitlements to reflect new plan
      refreshEntitlements()
      
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
      case "ai-workers":
        return <AiWorkersScreen />
      case "numbers":
        return <NumbersManagement />
      case "widgets":
        return <WidgetManagement />
      case "security":
        return <AbusePreventionSettings />
      case "access-control":
        return <AccessControlSettings />
      case "sms":
        return <SMSView />
      case "knowledge":
        return <KnowledgeBase />
      case "scheduling":
        return <Scheduling />
      case "billing":
        // Gate billing UI until org is loaded and exists
        if (orgLoading) {
          return (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="text-sm text-muted-foreground">Loading organization...</p>
              </div>
            </div>
          );
        }
        
        if (!organizationId) {
          return (
            <div className="flex items-center justify-center h-64">
              <div className="text-center space-y-4">
                <h3 className="text-lg font-semibold">No Organization Selected</h3>
                <p className="text-sm text-muted-foreground">
                  Please select or create an organization to access billing features.
                </p>
              </div>
            </div>
          );
        }
        
        return <UsageBilling organizationId={organizationId} />
      case "team":
        return <TeamManagement />
      case "teams":
        return <SettingsOrganization />
      case "organization":
        return <SettingsOrganization />
      case "profile":
        return <ProfileSettingsScreen />
      case "settings":
        return <UnifiedSettings organizationId="demo-org-id" />
      case "profile-settings":
        return <ProfileSettingsScreen />
      default:
        return <DashboardOverview />
    }
  }

  // Gate child render until org is loaded and valid
  if (orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading organization...</p>
        </div>
      </div>
    )
  }

  if (!organizationId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h3 className="text-lg font-semibold">No Organization Selected</h3>
          <p className="text-sm text-muted-foreground">
            Please select or create an organization to access the dashboard.
          </p>
        </div>
      </div>
    )
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
                 activeScreen === "sms" ? "SMS / 10DLC" :
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
