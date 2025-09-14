import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProfileSettings } from "./settings/ProfileSettings"
import { OrganizationInfo } from "./settings/OrganizationInfo"
import { NotificationSettings } from "./settings/NotificationSettings"
import { SecuritySettings } from "./settings/SecuritySettings"
import { PersonalDangerZone } from "./settings/PersonalDangerZone"

export function ProfileSettingsScreen() {
  const [activeTab, setActiveTab] = useState("profile")

  const renderContent = () => {
    switch (activeTab) {
      case "profile":
        return (
          <div className="space-y-6">
            <ProfileSettings />
            <OrganizationInfo />
          </div>
        )
      case "notifications":
        return <NotificationSettings />
      case "security":
        return <SecuritySettings />
      case "danger":
        return <PersonalDangerZone />
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Profile Settings</h1>
        <p className="text-muted-foreground mb-6">Manage your personal information and account settings</p>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-auto p-1 bg-muted/50">
            <TabsTrigger value="profile" className="text-xs">PROFILE</TabsTrigger>
            <TabsTrigger value="notifications" className="text-xs">NOTIFICATIONS</TabsTrigger>
            <TabsTrigger value="security" className="text-xs">SECURITY</TabsTrigger>
            <TabsTrigger value="danger" className="text-xs">DANGER ZONE</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1">
        {renderContent()}
      </div>
    </div>
  )
}