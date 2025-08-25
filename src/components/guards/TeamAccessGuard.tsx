import { ReactNode } from "react";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { useOrganizationRole } from "@/hooks/useOrganizationRole";
import { Skeleton } from "@/components/ui/skeleton";
import TeamAccessDenied from "@/pages/TeamAccessDenied";

interface TeamAccessGuardProps {
  children: ReactNode;
}

export function TeamAccessGuard({ children }: TeamAccessGuardProps) {
  const { organizationId, isOwner, loading: orgLoading } = useUserOrganization();
  const { isAdmin, loading: roleLoading } = useOrganizationRole(organizationId || undefined);

  // Show loading state while checking permissions
  if (orgLoading || roleLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  // Check if user has admin access (owner or admin role)
  const hasAdminAccess = isOwner || isAdmin;

  if (!hasAdminAccess) {
    return <TeamAccessDenied />;
  }

  return <>{children}</>;
}