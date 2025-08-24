import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "@/pages/Index";
import Dashboard from "@/pages/Dashboard";
import Auth from "@/pages/Auth";
import TalkToUs from "@/pages/TalkToUs";
import NotFound from "@/pages/NotFound";
import AgentSettings from "@/pages/AgentSettings";
import TeamsSettings from "@/pages/TeamsSettings";
import InviteAccept from "@/pages/InviteAccept";
import InviteAcceptPage from "@/pages/InviteAcceptPage";
import Demo from "@/pages/Demo";
import SettingsLayout from "@/pages/SettingsLayout";
import SettingsPersonal from "@/pages/SettingsPersonal";
import SettingsTeams from "@/pages/SettingsTeams";
import SettingsOrganization from "@/pages/SettingsOrganization";
import ActivityLogs from "@/pages/ActivityLogs";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminInviteTests from "@/pages/AdminInviteTests";
import AdminLogs from "@/pages/AdminLogs";
import AdminOrgLogs from "@/pages/AdminOrgLogs";

function App() {
  return (
    <AuthProvider>
      <TooltipProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/talk-to-us" element={<TalkToUs />} />
            <Route path="/agent-settings" element={<AgentSettings />} />
            <Route path="/settings/teams" element={<TeamsSettings />} />
            <Route path="/settings" element={<SettingsLayout />}>
              <Route path="personal" element={<SettingsPersonal />} />
              <Route path="teams" element={<SettingsTeams />} />
              <Route path="organization" element={<SettingsOrganization />} />
            </Route>
            <Route path="/invite/accept" element={<InviteAccept />} />
            <Route path="/invite/accept-new" element={<InviteAcceptPage />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/activity-logs" element={<ActivityLogs />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/logs" element={<AdminLogs />} />
            <Route path="/admin/logs/org/:orgId" element={<AdminOrgLogs />} />
            <Route path="/admin/tests/invites" element={<AdminInviteTests />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster />
        </Router>
      </TooltipProvider>
    </AuthProvider>
  );
}

export default App;