import { 
  BarChart3, 
  Phone, 
  Bot, 
  BookOpen, 
  Calendar, 
  CreditCard,
  Settings,
  Building2,
  Users
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
      <SidebarContent>
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
                    className={`h-9 px-3 ${activeScreen === item.url ? "bg-muted text-primary font-medium" : "hover:bg-muted/50"}`}
                  >
                    <item.icon className="h-4 w-4" />
                    {state !== "collapsed" && <span className="ml-3">{item.title}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}