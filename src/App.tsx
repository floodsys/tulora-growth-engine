import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { AdminSecurityWrapper } from "@/components/AdminSecurityWrapper";
import { HelmetProvider } from "react-helmet-async";
import { InviteAcceptRedirect } from "@/components/InviteAcceptRedirect";
import { RedirectToOrganizationTeam } from "@/components/RedirectToOrganizationTeam";
import Index from "@/pages/Index";
import Dashboard from "@/pages/Dashboard";
import Auth from "@/pages/Auth";
import TalkToUs from "@/pages/TalkToUs";
import NotFound from "@/pages/NotFound";
import AgentSettings from "@/pages/AgentSettings";
import InviteAccept from "@/pages/InviteAccept";
import Demo from "@/pages/Demo";
import SettingsLayout from "@/pages/SettingsLayout";
import { TeamAccessGuard } from "@/components/guards/TeamAccessGuard";

import SettingsTeams from "@/pages/SettingsTeams";
import SettingsOrganization from "@/pages/SettingsOrganization";
import ActivityLogs from "@/pages/ActivityLogs";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminSetup from "@/pages/AdminSetup";
import AdminInviteTests from "@/pages/AdminInviteTests";
import AdminOrgLogs from "@/pages/AdminOrgLogs";
import AdminAccessDenied from "@/pages/AdminAccessDenied";
import SecureDiagnostic from "@/pages/SecureDiagnostic";

function App() {
  return (
    <HelmetProvider>
      <AuthProvider>
        <TooltipProvider>
          <Router>
          <AdminSecurityWrapper>
            <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/talk-to-us" element={<TalkToUs />} />
            <Route path="/agent-settings" element={<AgentSettings />} />
            <Route path="/settings" element={<SettingsLayout />}>
              
              <Route path="teams" element={<RedirectToOrganizationTeam />} />
              <Route path="organization" element={<SettingsOrganization />} />
              <Route path="organization/team" element={<SettingsOrganization />} />
            </Route>
            <Route path="/invite/accept" element={<InviteAccept />} />
            <Route path="/invite/accept-new" element={<InviteAcceptRedirect />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/activity-logs" element={<ActivityLogs />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/_diag" element={<SecureDiagnostic />} />
            <Route path="/admin/access-denied" element={<AdminAccessDenied />} />
            <Route path="/admin-setup" element={<AdminSetup />} />
            <Route path="/admin/logs/org/:orgId" element={<AdminOrgLogs />} />
            <Route path="/admin/tests/invites" element={<AdminInviteTests />} />
            <Route path="*" element={<NotFound />} />
            </Routes>
            <Toaster />
          </AdminSecurityWrapper>
        </Router>
      </TooltipProvider>
    </AuthProvider>
    </HelmetProvider>
  );
}

export default App;