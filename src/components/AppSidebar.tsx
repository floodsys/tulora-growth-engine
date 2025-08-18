import { 
  BarChart3, 
  Phone, 
  Bot, 
  BookOpen, 
  Calendar, 
  CreditCard,
  Settings,
  Building2
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

const items = [
  { title: "Overview", url: "overview", icon: BarChart3 },
  { title: "Calls", url: "calls", icon: Phone },
  { title: "Agents", url: "agents", icon: Bot },
  { title: "Knowledge Base", url: "knowledge", icon: BookOpen },
  { title: "Scheduling", url: "scheduling", icon: Calendar },
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
          <SidebarGroupLabel className="px-4 py-2">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-brand" />
              {state !== "collapsed" && <span className="font-semibold">AI Outreach</span>}
            </div>
          </SidebarGroupLabel>
          
          {state !== "collapsed" && (
            <div className="px-4 py-2">
              <OrgSwitcher />
            </div>
          )}
          
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    onClick={() => setActiveScreen(item.url)}
                    className={activeScreen === item.url ? "bg-muted text-primary font-medium" : "hover:bg-muted/50"}
                  >
                    <item.icon className="h-4 w-4" />
                    {state !== "collapsed" && <span>{item.title}</span>}
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