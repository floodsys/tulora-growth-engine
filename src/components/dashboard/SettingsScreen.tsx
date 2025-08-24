import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProfileSettings } from "./settings/ProfileSettings"
import { NotificationSettings } from "./settings/NotificationSettings"
import { SecuritySettings } from "./settings/SecuritySettings"
import { PersonalDangerZone } from "./settings/PersonalDangerZone"
import { OrganizationSettings } from "./settings/OrganizationSettings"
import { MemberManagement } from "./settings/MemberManagement"
import { SeatManagement } from "./settings/SeatManagement"
import { BillingSettings } from "./settings/BillingSettings"
import { IntegrationsSettings } from "./settings/IntegrationsSettings"
import { ExportAndIntegrationsSettings } from "./settings/ExportAndIntegrationsSettings"
import { AlertsSettings } from "./settings/AlertsSettings"
import { OrganizationDangerZone } from "./settings/OrganizationDangerZone"

export function SettingsScreen() {
  const [activeTab, setActiveTab] = useState("profile")
  
  // TODO: Get user role from auth context - for now assume owner
  const isOwner = true

  const renderContent = () => {
    switch (activeTab) {
      case "profile":
        return <ProfileSettings />
      case "notifications":
        return <NotificationSettings />
      case "security":
        return <SecuritySettings />
      case "personal-danger":
        return <PersonalDangerZone />
      case "organization":
        return <OrganizationSettings />
      case "members":
        return <MemberManagement />
      case "seats":
        return <SeatManagement />
      case "billing":
        return <BillingSettings />
      case "integrations":
        return <IntegrationsSettings />
      case "exports":
        return <ExportAndIntegrationsSettings />
      case "alerts":
        return <AlertsSettings />
      case "org-danger":
        return <OrganizationDangerZone />
      default:
        return <ProfileSettings />
    }
  }

  return (
    <div className="space-y-6">
      <div className="border-b">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-12 h-auto p-1 bg-muted/50">
            <TabsTrigger value="profile" className="text-xs">PROFILE</TabsTrigger>
            <TabsTrigger value="notifications" className="text-xs">NOTIFICATIONS</TabsTrigger>
            <TabsTrigger value="security" className="text-xs">SECURITY</TabsTrigger>
            <TabsTrigger value="personal-danger" className="text-xs">DANGER ZONE</TabsTrigger>
            {isOwner && (
              <>
                <TabsTrigger value="organization" className="text-xs">ORGANIZATION</TabsTrigger>
                <TabsTrigger value="members" className="text-xs">MEMBERS</TabsTrigger>
                <TabsTrigger value="seats" className="text-xs">SEATS</TabsTrigger>
                <TabsTrigger value="billing" className="text-xs">BILLING</TabsTrigger>
                <TabsTrigger value="integrations" className="text-xs">INTEGRATIONS</TabsTrigger>
                <TabsTrigger value="exports" className="text-xs">EXPORTS</TabsTrigger>
                <TabsTrigger value="alerts" className="text-xs">ALERTS</TabsTrigger>
                <TabsTrigger value="org-danger" className="text-xs">ORG DANGER</TabsTrigger>
              </>
            )}
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1">
        {renderContent()}
      </div>
    </div>
  )
}