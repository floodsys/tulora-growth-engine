import { useState, useEffect } from "react"
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
  ChevronDown,
  Hash,
  User,
  Cpu
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
import { useUserOrganization } from "@/hooks/useUserOrganization"
import { useCanonicalUserRole } from "@/hooks/useCanonicalUserRole"
import { useRetellAgents } from "@/hooks/useRetellAgents"
import { useAuth } from "@/contexts/AuthContext"
import { useEntitlements } from "@/lib/entitlements/ssot"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"


const sidebarGroups = [
  {
    label: "Build",
    items: [
      { title: "AI Workers", url: "ai-workers", icon: Cpu },
      { title: "Agents", url: "agents", icon: Bot },
      { title: "Knowledge Base", url: "knowledge", icon: BookOpen },
    ]
  },
  {
    label: "Run", 
    items: [
      { title: "Calls", url: "calls", icon: Phone },
      { title: "Scheduling", url: "scheduling", icon: Calendar },
    ]
  },
  {
    label: "Channels",
    items: [
      { title: "Numbers", url: "numbers", icon: Hash },
      { title: "SMS / 10DLC", url: "sms", icon: MessageSquare },
      { title: "Widgets", url: "widgets", icon: MessageCircle },
    ]
  },
  {
    label: "Analyze",
    items: [
      { title: "Analytics", url: "overview", icon: BarChart3 },
      { title: "Usage & Billing", url: "billing", icon: CreditCard },
    ]
  },
  {
    label: "Admin",
    items: [
      { title: "Organization", url: "organization", icon: Building2 },
      { title: "Team", url: "team", icon: Users2 },
      { title: "Profile", url: "profile", icon: User },
      { title: "Access Control", url: "access-control", icon: Users },
      { title: "Security", url: "security", icon: Settings },
    ]
  }
]

interface AppSidebarProps {
  activeScreen: string
  setActiveScreen: (screen: string) => void
}

export function AppSidebar({ activeScreen, setActiveScreen }: AppSidebarProps) {
  const { state, setOpenMobile } = useSidebar()
  const isMobile = useIsMobile()
  const { organizationId } = useUserOrganization()
  const { isOwner, isAdmin } = useCanonicalUserRole(organizationId)
  const { agents } = useRetellAgents(organizationId)
  const { user } = useAuth()
  const { entitlements } = useEntitlements(organizationId)

  // Find which group contains the active screen
  const getActiveGroupIndex = () => {
    return sidebarGroups.findIndex(group => 
      group.items.some(item => item.url === activeScreen)
    )
  }

  // Initialize group expansion states - avoid initial flash by computing sync
  const [groupStates, setGroupStates] = useState<Record<number, boolean>>(() => {
    const storageKey = `sidebar-groups-${user?.id || 'anon'}-${organizationId || 'default'}-${isMobile ? 'm' : 'd'}`
    const saved = localStorage.getItem(storageKey)

    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        // ignore parse errors
      }
    }
    // First visit - expand all on desktop, collapse on mobile
    const defaultState: Record<number, boolean> = {}
    sidebarGroups.forEach((_, index) => {
      if (index === 0) return // Overview is always top-level, no group state needed
      defaultState[index] = !isMobile
    })
    return defaultState
  })

  // Re-evaluate defaults when org or viewport changes (preserve explicit saves)
  useEffect(() => {
    const storageKey = `sidebar-groups-${user?.id || 'anon'}-${organizationId || 'default'}-${isMobile ? 'm' : 'd'}`
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        setGroupStates(JSON.parse(saved))
        return
      } catch {}
    }
    const defaultState: Record<number, boolean> = {}
    sidebarGroups.forEach((_, index) => {
      if (index === 0) return
      defaultState[index] = !isMobile
    })
    setGroupStates(defaultState)
  }, [organizationId, user?.id, isMobile])

  // Ensure mobile sheet is closed by default
  useEffect(() => {
    if (isMobile) setOpenMobile(false)
  }, [isMobile, setOpenMobile])

  // Auto-expand group containing active route
  useEffect(() => {
    const activeGroupIndex = getActiveGroupIndex()
    if (activeGroupIndex > 0 && !groupStates[activeGroupIndex]) {
      setGroupStates(prev => ({
        ...prev,
        [activeGroupIndex]: true
      }))
    }
  }, [activeScreen])

  // Persist group states to localStorage
  useEffect(() => {
    const storageKey = `sidebar-groups-${user?.id || 'anon'}-${organizationId || 'default'}-${isMobile ? 'm' : 'd'}`
    localStorage.setItem(storageKey, JSON.stringify(groupStates))
  }, [groupStates, organizationId, user?.id, isMobile])

  const toggleGroup = (groupIndex: number) => {
    setGroupStates(prev => ({
      ...prev,
      [groupIndex]: !prev[groupIndex]
    }))
  }

  // Helper to check if item should be disabled based on entitlements
  const isItemDisabled = (itemTitle: string) => {
    switch (itemTitle) {
      case "Scheduling":
        return !entitlements.features.scheduling
      case "Numbers":
        return !entitlements.features.numbers
      case "SMS / 10DLC":
        return !entitlements.features.sms
      case "Widgets":
        return !entitlements.features.widgets
      default:
        return false
    }
  }

  // Helper to get upgrade tooltip message
  const getUpgradeMessage = (itemTitle: string) => {
    return `${itemTitle} requires a plan upgrade. Contact sales to unlock this feature.`
  }

  // Filter groups based on permissions and capabilities
  const filteredGroups = sidebarGroups.map(group => {
    if (group.label === "Admin" && !isOwner && !isAdmin) {
      return null // Hide entire Admin group for non-admin users
    }
    
    return {
      ...group,
      items: group.items.filter(item => {
        // Remove duplicate Profile entry that already exists elsewhere
        if (group.label === "Admin" && item.title === "Profile") {
          return false
        }
        // Keep all other items visible; just disable them if needed
        return true
      })
    }
  }).filter(Boolean) as typeof sidebarGroups

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
              {filteredGroups.map((group, groupIndex) => (
                <div key={groupIndex} className={groupIndex > 0 ? "mt-6" : ""}>
                  {group.label && (state !== "collapsed" || isMobile) && (
                    <div className="px-3 mb-2">
                      <button
                        onClick={() => toggleGroup(groupIndex)}
                        className="flex items-center justify-between w-full text-xs font-medium text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
                      >
                        <span>{group.label}</span>
                        {groupStates[groupIndex] ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  )}
                  {(groupStates[groupIndex] === true || groupIndex === 0) && (
                    <SidebarMenu className="space-y-1">
                      {group.items.map((item) => {
                        const disabled = isItemDisabled(item.title)
                        const menuButton = (
                          <SidebarMenuButton 
                            onClick={() => !disabled && setActiveScreen(item.url)}
                            className={`h-10 ${state === "collapsed" && !isMobile ? "pl-1 pr-4" : "px-3"} ${
                              activeScreen === item.url ? "bg-muted text-primary font-medium" : "hover:bg-muted"
                            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                            disabled={disabled}
                          >
                            <item.icon className="h-4 w-4" />
                            {(state !== "collapsed" || isMobile) && <span className="ml-3">{item.title}</span>}
                          </SidebarMenuButton>
                        )

                        return (
                          <SidebarMenuItem key={item.title}>
                            {disabled ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    {menuButton}
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{getUpgradeMessage(item.title)}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              menuButton
                            )}
                          </SidebarMenuItem>
                        )
                      })}
                    </SidebarMenu>
                  )}
                </div>
              ))}
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
