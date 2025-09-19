import { useEffect } from "react";
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

import ProfileTest from "@/pages/ProfileTest";
import TalkToUs from "@/pages/TalkToUs";
import RetellAgentSettings from "@/pages/RetellAgentSettings";
import { AgentSettingsPage } from "@/components/AgentSettingsPage";
import NotFound from "@/pages/NotFound";

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

import AdminOrgLogs from "@/pages/AdminOrgLogs";
import AdminAccessDenied from "@/pages/AdminAccessDenied";
import AdminMFADiag from "@/pages/AdminMFADiag";
import AdminStripeConfig from "@/pages/AdminStripeConfig";
import AdminBillingVerification from "@/pages/AdminBillingVerification";
import AdminAgents from "@/pages/admin/agents";
import AdminCalls from "@/pages/admin/calls";
import ContactSales from "@/pages/ContactSales";
import AdminSelfCheck from "@/pages/AdminSelfCheck";
import AdminContactSettings from "@/pages/AdminContactSettings";
import AdminNotifications from "@/pages/AdminNotifications";
import Pricing from "@/pages/Pricing";
import { ObservabilityDashboard } from "@/pages/admin/ObservabilityDashboard";

import { AdminGuard } from "@/components/admin/AdminGuard";

// Component to disable service worker on admin routes
function ServiceWorkerManager() {
  useEffect(() => {
    const isAdminRoute = window.location.pathname.startsWith('/admin');
    
    if (isAdminRoute && 'serviceWorker' in navigator) {
      // Disable service worker on admin routes
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => {
          registration.unregister();
        });
      });
    }
  }, []);

  return null;
}

function App() {
  return (
    <HelmetProvider>
      <AuthProvider>
        <TooltipProvider>
          <Router>
            <ServiceWorkerManager />
            <AdminSecurityWrapper>
            <ProgressiveProfilingGuard>
              <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/onboarding/organization" element={<OnboardingOrganization />} />
              
              <Route path="/profile-test" element={<ProfileTest />} />
              <Route path="/talk-to-us" element={<TalkToUs />} />
               <Route path="/retell-agent/:agentId" element={<RetellAgentSettings />} />
               <Route path="/agent/:agentId/settings" element={<AgentSettingsPage />} />
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
              <Route path="/admin/access-denied" element={<AdminAccessDenied />} />
              <Route path="/admin-setup" element={<AdminSetup />} />
              <Route path="/admin/logs/org/:orgId" element={<AdminOrgLogs />} />
              <Route path="/admin/agents" element={<AdminGuard><AdminAgents /></AdminGuard>} />
               <Route path="/admin/calls" element={<AdminGuard><AdminCalls /></AdminGuard>} />
               <Route path="/admin/observability" element={<AdminGuard><ObservabilityDashboard /></AdminGuard>} />
              <Route path="/admin/contact-settings" element={<AdminGuard><AdminContactSettings /></AdminGuard>} />
              <Route path="/admin/notifications" element={<AdminGuard><AdminNotifications /></AdminGuard>} />
              <Route path="/admin/stripe-config" element={<AdminGuard><AdminStripeConfig /></AdminGuard>} />
               <Route path="/admin/billing-verification" element={<AdminGuard><AdminBillingVerification /></AdminGuard>} />
               <Route path="/admin/self-check" element={<AdminSelfCheck />} />
               <Route path="/pricing" element={<Pricing />} />
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