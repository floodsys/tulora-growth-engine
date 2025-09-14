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
  MessageSquare,
  Users2,
  PlayCircle,
  ChevronRight,
  Key
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
import { useIsMobile } from "@/hooks/use-mobile"
import { Link } from "react-router-dom"
import logo from "@/assets/logo.svg"
import iconLogo from "@/assets/logo_icon_v2.svg"


const items = [
  { title: "Overview", url: "overview", icon: BarChart3 },
  { title: "Calls", url: "calls", icon: Phone },
  { title: "Agents", url: "agents", icon: Bot },
  { title: "Numbers", url: "numbers", icon: Phone },
  { title: "Knowledge Base", url: "knowledge", icon: BookOpen },
  { title: "Chat Widget", url: "chat-widget", icon: MessageSquare },
  { title: "Scheduling", url: "scheduling", icon: Calendar },
  { title: "Team", url: "organization", icon: Users },
  { title: "Organization", url: "organization", icon: Building2 },
  { title: "Abuse Prevention", url: "abuse-prevention", icon: Settings },
  { title: "Access Control", url: "access-control", icon: Key },
  { title: "Usage & Billing", url: "billing", icon: CreditCard },
]

interface AppSidebarProps {
  activeScreen: string
  setActiveScreen: (screen: string) => void
}

export function AppSidebar({ activeScreen, setActiveScreen }: AppSidebarProps) {
  const { state } = useSidebar()
  const isMobile = useIsMobile()

  return (
    <Sidebar 
      className={
        isMobile 
          ? "w-full" 
          : state === "collapsed" 
            ? "w-20" 
            : "w-60"
      } 
      collapsible="icon"
    >
      <SidebarContent className="flex flex-col h-full">
        <div className="flex-1 space-y-4">
          <SidebarGroup>
            <SidebarGroupLabel className={isMobile ? "px-4 py-4 mb-2" : state === "collapsed" ? "px-2 py-4 mb-3" : "px-6 py-6 mb-3"}>
              {state === "collapsed" && !isMobile ? (
                <div className="flex justify-center items-center w-full">
                  <img 
                    src={iconLogo} 
                    alt="Icon Logo" 
                    className="h-8 w-8 object-contain flex-shrink-0" 
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link to="/">
                    <img src={logo} alt="Your Logo" className="h-8 w-auto max-w-[120px] object-contain" />
                  </Link>
                </div>
              )}
            </SidebarGroupLabel>
            
            {(state !== "collapsed" || isMobile) && (
              <div className={isMobile ? "px-4 py-2 mb-2" : "px-6 py-4 mb-3"}>
                <OrgSwitcher />
              </div>
            )}
            
            <SidebarGroupContent className={state === "collapsed" && !isMobile ? "pl-1 pr-4" : "px-3"}>
              <SidebarMenu className="space-y-1">
                {items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      onClick={() => setActiveScreen(item.url)}
                      className={`h-10 ${state === "collapsed" && !isMobile ? "pl-1 pr-4" : "px-3"} ${activeScreen === item.url ? "bg-muted text-primary font-medium" : "hover:bg-muted"}`}
                    >
                      <item.icon className="h-4 w-4" />
                      {(state !== "collapsed" || isMobile) && <span className="ml-3">{item.title}</span>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </div>
        
        {/* Bottom section with Help, Notifications, and Profile */}
        <div className="mt-auto border-t pt-4">
          {/* Help & Notifications */}
          {(state !== "collapsed" || isMobile) && (
            <SidebarGroup>
              <SidebarGroupContent className="px-3">
                <SidebarMenu className="space-y-1">
                   {/* Notifications */}
                   <SidebarMenuItem>
                     <SidebarMenuButton 
                       onClick={() => setActiveScreen("notifications")}
                       className={`h-10 px-3 ${activeScreen === "notifications" ? "bg-muted text-primary font-medium" : "hover:bg-muted"}`}
                     >
                       <div className="flex items-center">
                         <Bell className="h-4 w-4" />
                         <span className="ml-3">Notifications</span>
                       </div>
                     </SidebarMenuButton>
                   </SidebarMenuItem>

                  {/* Help with Popover Menu */}
                  <SidebarMenuItem>
                    <Popover>
                      <PopoverTrigger asChild>
                        <SidebarMenuButton 
                          className={`h-10 px-3 ${activeScreen === "help" ? "bg-muted text-primary font-medium" : "hover:bg-muted"} w-full justify-between`}
                        >
                          <div className="flex items-center">
                            <HelpCircle className="h-4 w-4" />
                            <span className="ml-3">Help</span>
                          </div>
                          <ChevronRight className="h-4 w-4" />
                        </SidebarMenuButton>
                      </PopoverTrigger>
                      <PopoverContent 
                        side={isMobile ? "top" : "right"} 
                        align="center" 
                        alignOffset={isMobile ? 0 : -80} 
                        className="w-56 p-2" 
                        sideOffset={8}
                      >
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
          {state === "collapsed" && !isMobile && (
            <SidebarGroup>
              <SidebarGroupContent className="pl-1 pr-4">
                <SidebarMenu className="space-y-1">
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      onClick={() => setActiveScreen("notifications")}
                      className={`h-10 pl-1 pr-4 ${activeScreen === "notifications" ? "bg-muted text-primary font-medium" : "hover:bg-muted"}`}
                    >
                      <Bell className="h-4 w-4" />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton className="h-10 pl-1 pr-4 hover:bg-muted">
                      <HelpCircle className="h-4 w-4" />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {/* Profile Avatar at bottom */}
          <div className={state === "collapsed" && !isMobile ? "pl-1 pr-4 py-2" : "p-3"}>
            <ProfileAvatar activeScreen={activeScreen} setActiveScreen={setActiveScreen} />
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  )
}