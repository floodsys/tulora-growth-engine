import { useState } from "react"
import { User, Building2, Key, Shield, CreditCard, Trash2, Bell, Camera, Users, Settings2 } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
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
    <div className="flex h-full">
      <Sidebar className="w-64 border-r">
        <SidebarContent>
          <div className="p-4">
            <h2 className="text-lg font-semibold">Settings</h2>
          </div>
          
          <SidebarGroup>
            <SidebarGroupLabel className="px-4">Personal Settings</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {personalSettingsItems.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      onClick={() => {
                        setActiveTab("personal")
                        setActiveSection(item.id)
                      }}
                      className={`${
                        activeSection === item.id ? "bg-muted text-primary font-medium" : "hover:bg-muted/50"
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {isOwner && (
            <SidebarGroup>
              <SidebarGroupLabel className="px-4">Organization Settings</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {organizationSettingsItems.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        onClick={() => {
                          setActiveTab("organization")
                          setActiveSection(item.id)
                        }}
                        className={`${
                          activeSection === item.id ? "bg-muted text-primary font-medium" : "hover:bg-muted/50"
                        }`}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>
      </Sidebar>

      <div className="flex-1 p-6">
        {renderSettingsContent()}
      </div>
    </div>
  )
}