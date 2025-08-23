import { NavLink, useLocation } from "react-router-dom";
import { User, Building2, Users, Settings, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { useOrganizationRole } from "@/hooks/useOrganizationRole";

interface SettingsSidebarProps {
  onBack: () => void;
}

export function SettingsSidebar({ onBack }: SettingsSidebarProps) {
  const location = useLocation();
  const { organizationId, isOwner } = useUserOrganization();
  const { isAdmin } = useOrganizationRole(organizationId || undefined);

  const currentPath = location.pathname;

  const getNavClasses = (path: string) => {
    const isActive = currentPath === path;
    return `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:bg-accent ${
      isActive 
        ? 'bg-accent text-accent-foreground font-medium' 
        : 'text-muted-foreground hover:text-foreground'
    }`;
  };

  return (
    <div className="w-64 border-r bg-muted/50 h-full">
      <div className="flex h-full max-h-screen flex-col gap-2">
        {/* Header */}
        <div className="flex h-14 items-center border-b px-4 lg:h-16 lg:px-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>

        {/* Navigation */}
        <div className="flex-1">
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
            <div className="space-y-1">
              <h3 className="mb-2 px-3 text-lg font-semibold tracking-tight flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Settings
              </h3>

              {/* Personal Settings - Everyone can access */}
              <NavLink to="/settings/personal" className={getNavClasses('/settings/personal')}>
                <User className="h-4 w-4" />
                Personal Settings
              </NavLink>

              {/* Teams - Admins and Owners */}
              {(isAdmin || isOwner) && (
                <NavLink to="/settings/teams" className={getNavClasses('/settings/teams')}>
                  <Users className="h-4 w-4" />
                  Teams
                </NavLink>
              )}

              {/* Organization Settings - Owners only */}
              {isOwner && (
                <NavLink to="/settings/organization" className={getNavClasses('/settings/organization')}>
                  <Building2 className="h-4 w-4" />
                  Organization Settings
                </NavLink>
              )}
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}