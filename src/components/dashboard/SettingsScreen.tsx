import { useState } from "react"
import { User, Building2, Key, Shield, CreditCard, Trash2, Bell, Users, Settings2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  const [activePersonalSection, setActivePersonalSection] = useState<string>("profile")
  const [activeOrgSection, setActiveOrgSection] = useState<string>("organization")
  
  // TODO: Get user role from auth context - for now assume owner
  const isOwner = true // This should come from your auth context

  const renderPersonalContent = () => {
    switch (activePersonalSection) {
      case "profile":
        return <ProfileSettings />
      case "notifications":
        return <NotificationSettings />
      case "security":
        return <SecuritySettings />
      case "personal-danger":
        return <PersonalDangerZone />
      default:
        return <ProfileSettings />
    }
  }

  const renderOrgContent = () => {
    switch (activeOrgSection) {
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
        return <OrganizationSettings />
    }
  }

  return (
    <div className="h-full max-h-[calc(100vh-8rem)]">
      <Tabs defaultValue="personal" className="h-full flex flex-col">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="personal">Personal Settings</TabsTrigger>
          {isOwner && <TabsTrigger value="organization">Organization Settings</TabsTrigger>}
        </TabsList>
        
        <TabsContent value="personal" className="flex-1 flex mt-6">
          {/* Personal Settings Navigation */}
          <div className="w-64 border-r bg-background">
            <div className="p-4 space-y-1">
              {personalSettingsItems.map((item) => (
                <Button
                  key={item.id}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "w-full justify-start h-9",
                    activePersonalSection === item.id && "bg-muted text-primary font-medium"
                  )}
                  onClick={() => setActivePersonalSection(item.id)}
                >
                  <item.icon className="h-4 w-4 mr-3" />
                  {item.title}
                </Button>
              ))}
            </div>
          </div>

          {/* Personal Settings Content */}
          <div className="flex-1 overflow-auto">
            <div className="p-6">
              {renderPersonalContent()}
            </div>
          </div>
        </TabsContent>

        {isOwner && (
          <TabsContent value="organization" className="flex-1 flex mt-6">
            {/* Organization Settings Navigation */}
            <div className="w-64 border-r bg-background">
              <div className="p-4 space-y-1">
                {organizationSettingsItems.map((item) => (
                  <Button
                    key={item.id}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "w-full justify-start h-9",
                      activeOrgSection === item.id && "bg-muted text-primary font-medium"
                    )}
                    onClick={() => setActiveOrgSection(item.id)}
                  >
                    <item.icon className="h-4 w-4 mr-3" />
                    {item.title}
                  </Button>
                ))}
              </div>
            </div>

            {/* Organization Settings Content */}
            <div className="flex-1 overflow-auto">
              <div className="p-6">
                {renderOrgContent()}
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}