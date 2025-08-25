import { OrgSwitcherTests } from "./OrgSwitcherTests"
import { ProfileUpdateTests } from "./ProfileUpdateTests"
import { DemoArtifactLinter } from "./DemoArtifactLinter"
import { OrganizationProfileTests } from "./OrganizationProfileTests"
import { TeamsConsolidationTests } from "./TeamsConsolidationTests"

export function TestDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Organization System Tests</h1>
        <p className="text-muted-foreground">
          Testing consolidation, routing, RBAC, UI invariants, and system integrity
        </p>
      </div>

      <div className="grid gap-6">
        <OrganizationProfileTests />
        <TeamsConsolidationTests />
        <OrgSwitcherTests />
        <ProfileUpdateTests />
        <DemoArtifactLinter />
      </div>
    </div>
  )
}