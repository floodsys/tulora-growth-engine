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
import AuthCallback from "@/pages/AuthCallback";
import OnboardingOrganization from "@/pages/OnboardingOrganization";
import CompleteProfile from "@/pages/CompleteProfile";
import ProfileTest from "@/pages/ProfileTest";
import TalkToUs from "@/pages/TalkToUs";
import NotFound from "@/pages/NotFound";
import AgentSettings from "@/pages/AgentSettings";
import InviteAccept from "@/pages/InviteAccept";
import Demo from "@/pages/Demo";
import VoiceDemo from "@/pages/demos/voice";
import SettingsLayout from "@/pages/SettingsLayout";
import { TeamAccessGuard } from "@/components/guards/TeamAccessGuard";
import ProgressiveProfilingGuard from "@/components/guards/ProgressiveProfilingGuard";

import SettingsTeams from "@/pages/SettingsTeams";
import SettingsOrganization from "@/pages/SettingsOrganization";
import ActivityLogs from "@/pages/ActivityLogs";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminSetup from "@/pages/AdminSetup";
import AdminInviteTests from "@/pages/AdminInviteTests";
import AdminOrgLogs from "@/pages/AdminOrgLogs";
import AdminAccessDenied from "@/pages/AdminAccessDenied";
import SecureDiagnostic from "@/pages/SecureDiagnostic";
import AdminMFADiag from "@/pages/AdminMFADiag";
import AdminDiagnostic from "@/pages/AdminDiagnostic";
import AdminStripeConfig from "@/pages/AdminStripeConfig";
import AdminBillingVerification from "@/pages/AdminBillingVerification";
import AdminAgents from "@/pages/admin/agents";
import AdminCalls from "@/pages/admin/calls";
import ContactSales from "@/pages/ContactSales";

import { AdminGuard } from "@/components/admin/AdminGuard";

function App() {
  return (
    <HelmetProvider>
      <AuthProvider>
        <TooltipProvider>
          <Router>
          <AdminSecurityWrapper>
            <ProgressiveProfilingGuard>
              <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/onboarding/organization" element={<OnboardingOrganization />} />
              <Route path="/complete-profile" element={<CompleteProfile />} />
              <Route path="/profile-test" element={<ProfileTest />} />
              <Route path="/talk-to-us" element={<TalkToUs />} />
              <Route path="/agent-settings" element={<AgentSettings />} />
              <Route path="/app/agents/:agentId" element={<AgentSettings />} />
              <Route path="/settings" element={<SettingsLayout />}>
                
                <Route path="teams" element={<RedirectToOrganizationTeam />} />
                <Route path="organization" element={<SettingsOrganization />} />
                <Route path="organization/team" element={<SettingsOrganization />} />
              </Route>
              <Route path="/invite/accept" element={<InviteAccept />} />
              <Route path="/invite/accept-new" element={<InviteAcceptRedirect />} />
              <Route path="/demo" element={<Demo />} />
              <Route path="/demos/voice" element={<VoiceDemo />} />
              <Route path="/activity-logs" element={<ActivityLogs />} />
              <Route path="/admin" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
              <Route path="/admin/_diag" element={<AdminDiagnostic />} />
              <Route path="/admin/_mfa_diag" element={<AdminMFADiag />} />
              <Route path="/admin/access-denied" element={<AdminAccessDenied />} />
              <Route path="/admin-setup" element={<AdminSetup />} />
              <Route path="/admin/logs/org/:orgId" element={<AdminOrgLogs />} />
              <Route path="/admin/tests/invites" element={<AdminInviteTests />} />
              <Route path="/admin/agents" element={<AdminGuard><AdminAgents /></AdminGuard>} />
              <Route path="/admin/calls" element={<AdminGuard><AdminCalls /></AdminGuard>} />
              <Route path="/admin/stripe-config" element={<AdminGuard><AdminStripeConfig /></AdminGuard>} />
              <Route path="/admin/billing-verification" element={<AdminGuard><AdminBillingVerification /></AdminGuard>} />
              <Route path="/contact/sales" element={<ContactSales />} />
              <Route path="*" element={<NotFound />} />
              </Routes>
            </ProgressiveProfilingGuard>
            <Toaster />
          </AdminSecurityWrapper>
        </Router>
      </TooltipProvider>
    </AuthProvider>
    </HelmetProvider>
  );
}

export default App;