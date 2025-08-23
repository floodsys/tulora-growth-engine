import { 
  BarChart3, 
  Phone, 
  Bot, 
  BookOpen, 
  Calendar, 
  CreditCard,
  Settings,
  Building2,
  Users,
  Bell,
  HelpCircle,
  MessageCircle,
  Users2,
  PlayCircle,
  ChevronDown,
  ChevronRight
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { OrgSwitcher } from "@/components/dashboard/widgets/OrgSwitcher"
import { ProfileAvatar } from "@/components/ProfileAvatar"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import logo from "@/assets/logo.svg"
import { useState } from "react"


const items = [
  { title: "Overview", url: "overview", icon: BarChart3 },
  { title: "Calls", url: "calls", icon: Phone },
  { title: "Agents", url: "agents", icon: Bot },
  { title: "Knowledge Base", url: "knowledge", icon: BookOpen },
  { title: "Scheduling", url: "scheduling", icon: Calendar },
  { title: "Team", url: "team", icon: Users },
  { title: "Usage & Billing", url: "billing", icon: CreditCard },
]

interface AppSidebarProps {
  activeScreen: string
  setActiveScreen: (screen: string) => void
}

export function AppSidebar({ activeScreen, setActiveScreen }: AppSidebarProps) {
  const { state } = useSidebar()
  const [helpExpanded, setHelpExpanded] = useState(false)

  return (
    <Sidebar className={state === "collapsed" ? "w-14" : "w-60"} collapsible="icon">
      <SidebarContent className="flex flex-col h-full">
        <div className="flex-1">
          <SidebarGroup>
            <SidebarGroupLabel className="px-6 py-6 mb-3">
              <div className="flex items-center gap-2">
                {state === "collapsed" ? (
                  <img src={logo} alt="Logo" className="h-6 w-auto object-contain" />
                ) : (
                  <img src={logo} alt="Your Logo" className="h-8 w-auto max-w-[120px] object-contain" />
                )}
              </div>
            </SidebarGroupLabel>
            
            {state !== "collapsed" && (
              <div className="px-6 py-4 mb-3">
                <OrgSwitcher />
              </div>
            )}
            
            <SidebarGroupContent className="px-3">
              <SidebarMenu className="space-y-0">
                {items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      onClick={() => setActiveScreen(item.url)}
                      className={`h-9 px-3 ${activeScreen === item.url ? "bg-muted text-primary font-medium" : "hover:bg-muted/70"}`}
                    >
                      <item.icon className="h-4 w-4" />
                      {state !== "collapsed" && <span className="ml-3">{item.title}</span>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </div>
        
        {/* Bottom section with Help, Notifications, and Profile */}
        <div className="mt-auto border-t">
          {/* Help & Notifications */}
          {state !== "collapsed" && (
            <SidebarGroup>
              <SidebarGroupContent className="px-3 pt-3">
                <SidebarMenu className="space-y-0">
                  {/* Notifications */}
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      onClick={() => setActiveScreen("notifications")}
                      className={`h-9 px-3 ${activeScreen === "notifications" ? "bg-muted text-primary font-medium" : "hover:bg-muted/70"}`}
                    >
                      <Bell className="h-4 w-4" />
                      <span className="ml-3">Notifications</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  {/* Help with Submenu */}
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      onClick={() => setActiveScreen("help")}
                      className={`h-9 px-3 ${activeScreen === "help" ? "bg-muted text-primary font-medium" : "hover:bg-muted/70"} relative group`}
                    >
                      <HelpCircle className="h-4 w-4" />
                      <span className="ml-3">Help</span>
                      {/* Side popup menu */}
                      <div className="absolute left-full top-0 ml-2 w-48 bg-background border shadow-lg rounded-md py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                        <div 
                          className="px-3 py-2 text-sm hover:bg-muted/70 cursor-pointer flex items-center"
                          onClick={(e) => {
                            e.stopPropagation()
                            setActiveScreen("contact-us")
                          }}
                        >
                          <MessageCircle className="h-3 w-3 mr-2" />
                          Contact us
                        </div>
                        <div className="px-3 py-2 text-sm cursor-not-allowed opacity-60 flex items-center">
                          <Users2 className="h-3 w-3 mr-2" />
                          Community
                          <Badge variant="secondary" className="ml-auto text-xs">
                            Coming Soon
                          </Badge>
                        </div>
                        <div 
                          className="px-3 py-2 text-sm hover:bg-muted/70 cursor-pointer flex items-center"
                          onClick={(e) => {
                            e.stopPropagation()
                            setActiveScreen("tutorials")
                          }}
                        >
                          <PlayCircle className="h-3 w-3 mr-2" />
                          Tutorials
                        </div>
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
          
          {/* Collapsed state - icon only */}
          {state === "collapsed" && (
            <SidebarGroup>
              <SidebarGroupContent className="px-3 pt-3">
                <SidebarMenu className="space-y-1">
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      onClick={() => setActiveScreen("notifications")}
                      className={`h-9 px-3 ${activeScreen === "notifications" ? "bg-muted text-primary font-medium" : "hover:bg-muted/70"}`}
                    >
                      <Bell className="h-4 w-4" />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton className="h-9 px-3 hover:bg-muted/70">
                      <HelpCircle className="h-4 w-4" />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {/* Profile Avatar at bottom */}
          <div className="p-3">
            <ProfileAvatar activeScreen={activeScreen} setActiveScreen={setActiveScreen} />
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  )
}