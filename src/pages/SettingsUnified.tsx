import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { useOrganizationRole } from "@/hooks/useOrganizationRole";
import { TeamAccessGuard } from "@/components/guards/TeamAccessGuard";

// Import the existing team management content
import SettingsTeams from "@/pages/SettingsTeams";
import SettingsOrganization from "@/pages/SettingsOrganization";

export default function SettingsUnified() {
  const { organizationId, isOwner } = useUserOrganization();
  const { isAdmin } = useOrganizationRole(organizationId || undefined);

  // Check if user has access to team settings
  const hasTeamAccess = isAdmin || isOwner;

  return (
    <div className="space-y-6">
      <Tabs defaultValue="teams" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="teams" disabled={!hasTeamAccess}>
            Teams
          </TabsTrigger>
          <TabsTrigger value="organization" disabled={!isOwner}>
            Organization
          </TabsTrigger>
        </TabsList>

        <TabsContent value="teams" className="mt-6">
          {hasTeamAccess ? (
            <TeamAccessGuard>
              <SettingsTeams />
            </TeamAccessGuard>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              You don't have permission to access team settings.
            </div>
          )}
        </TabsContent>

        <TabsContent value="organization" className="mt-6">
          {isOwner ? (
            <SettingsOrganization />
          ) : (
            <div className="text-center text-muted-foreground py-8">
              Only organization owners can access organization settings.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}