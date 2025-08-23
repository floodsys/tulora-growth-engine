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
  useSidebar,
} from "@/components/ui/sidebar"
import { OrgSwitcher } from "@/components/dashboard/widgets/OrgSwitcher"
import { ProfileAvatar } from "@/components/ProfileAvatar"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import logo from "@/assets/logo.svg"


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
                      className={`h-9 px-3 ${activeScreen === item.url ? "bg-muted text-primary font-medium" : "hover:bg-muted"}`}
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
                      className={`h-9 px-3 ${activeScreen === "notifications" ? "bg-muted text-primary font-medium" : "hover:bg-muted"}`}
                    >
                      <Bell className="h-4 w-4" />
                      <span className="ml-3">Notifications</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  {/* Help with Popover Menu */}
                  <SidebarMenuItem>
                    <Popover>
                      <PopoverTrigger asChild>
                        <SidebarMenuButton 
                          className={`h-9 px-3 ${activeScreen === "help" ? "bg-muted text-primary font-medium" : "hover:bg-muted"} w-full justify-between`}
                        >
                          <div className="flex items-center">
                            <HelpCircle className="h-4 w-4" />
                            <span className="ml-3">Help</span>
                          </div>
                          <ChevronRight className="h-4 w-4" />
                        </SidebarMenuButton>
                      </PopoverTrigger>
                      <PopoverContent side="right" align="start" className="w-56 p-2">
                        <div className="space-y-1">
                          <button
                            onClick={() => setActiveScreen("contact-us")}
                            className="flex items-center w-full px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
                          >
                            <MessageCircle className="h-4 w-4 mr-3" />
                            Contact us
                          </button>
                          <button className="flex items-center w-full px-3 py-2 text-sm rounded-md cursor-not-allowed opacity-60">
                            <Users2 className="h-4 w-4 mr-3" />
                            Community
                            <Badge variant="secondary" className="ml-auto text-xs">
                              Coming Soon
                            </Badge>
                          </button>
                          <button
                            onClick={() => setActiveScreen("tutorials")}
                            className="flex items-center w-full px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
                          >
                            <PlayCircle className="h-4 w-4 mr-3" />
                            Tutorials
                          </button>
                        </div>
                      </PopoverContent>
                    </Popover>
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
                      className={`h-9 px-3 ${activeScreen === "notifications" ? "bg-muted text-primary font-medium" : "hover:bg-muted"}`}
                    >
                      <Bell className="h-4 w-4" />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton className="h-9 px-3 hover:bg-muted">
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