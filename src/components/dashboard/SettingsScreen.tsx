import { useState } from "react"
import { User, Building2, Key, Shield, CreditCard, Trash2, Bell, Users, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { ProfileSettings } from "./settings/ProfileSettings"
import { NotificationSettings } from "./settings/NotificationSettings"
import { SecuritySettings } from "./settings/SecuritySettings"
import { PersonalDangerZone } from "./settings/PersonalDangerZone"
import { OrganizationSettings } from "./settings/OrganizationSettings"
import { MemberManagement } from "./settings/MemberManagement"
import { SeatManagement } from "./settings/SeatManagement"
import { BillingSettings } from "./settings/BillingSettings"
import { IntegrationsSettings } from "./settings/IntegrationsSettings"
import { OrganizationDangerZone } from "./settings/OrganizationDangerZone"

const personalSettingsItems = [
  { title: "Profile", id: "profile", icon: User },
  { title: "Notifications", id: "notifications", icon: Bell },
  { title: "Security", id: "security", icon: Shield },
  { title: "Danger Zone", id: "personal-danger", icon: Trash2 },
]

const organizationSettingsItems = [
  { title: "Organization", id: "organization", icon: Building2 },
  { title: "Members", id: "members", icon: Users },
  { title: "Seat Management", id: "seats", icon: Settings2 },
  { title: "Billing", id: "billing", icon: CreditCard },
  { title: "Integrations", id: "integrations", icon: Key },
  { title: "Danger Zone", id: "org-danger", icon: Trash2 },
]

type SettingsTab = "personal" | "organization"
type SettingsSection = string

export function SettingsScreen() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("personal")
  const [activeSection, setActiveSection] = useState<SettingsSection>("profile")
  
  // TODO: Get user role from auth context - for now assume owner
  const isOwner = true // This should come from your auth context

  const renderSettingsContent = () => {
    switch (activeSection) {
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
      case "org-danger":
        return <OrganizationDangerZone />
      default:
        return <ProfileSettings />
    }
  }

  return (
    <div className="flex h-full max-h-[calc(100vh-8rem)]">
      {/* Settings Navigation */}
      <div className="w-64 border-r bg-background">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Settings</h2>
        </div>
        
        <div className="p-4 space-y-6">
          {/* Personal Settings */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Personal Settings</h3>
            <div className="space-y-1">
              {personalSettingsItems.map((item) => (
                <Button
                  key={item.id}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "w-full justify-start h-9",
                    activeSection === item.id && "bg-muted text-primary font-medium"
                  )}
                  onClick={() => {
                    setActiveTab("personal")
                    setActiveSection(item.id)
                  }}
                >
                  <item.icon className="h-4 w-4 mr-3" />
                  {item.title}
                </Button>
              ))}
            </div>
          </div>

          {/* Organization Settings */}
          {isOwner && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Organization Settings</h3>
              <div className="space-y-1">
                {organizationSettingsItems.map((item) => (
                  <Button
                    key={item.id}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "w-full justify-start h-9",
                      activeSection === item.id && "bg-muted text-primary font-medium"
                    )}
                    onClick={() => {
                      setActiveTab("organization")
                      setActiveSection(item.id)
                    }}
                  >
                    <item.icon className="h-4 w-4 mr-3" />
                    {item.title}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {renderSettingsContent()}
        </div>
      </div>
    </div>
  )
}