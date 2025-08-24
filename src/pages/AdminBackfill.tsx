import { useState } from "react"
import Navigation from "@/components/Navigation"
import { AppSidebar } from "@/components/AppSidebar"
import { AuditLogBackfill } from "@/components/dashboard/AuditLogBackfill"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

export default function AdminBackfill() {
  const [activeScreen, setActiveScreen] = useState("admin-backfill");
  
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <SidebarProvider>
        <AppSidebar activeScreen={activeScreen} setActiveScreen={setActiveScreen} />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/dashboard">
                    Dashboard
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/admin/logs">
                    Admin
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Audit Backfill</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4">
            <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min p-6">
              <div className="max-w-4xl mx-auto space-y-6">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">Audit Log Backfill</h1>
                  <p className="text-muted-foreground">
                    Generate historical audit events for existing organization data
                  </p>
                </div>
                
                <AuditLogBackfill />
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}