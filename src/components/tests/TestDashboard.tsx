import { OrgSwitcherTests } from "./OrgSwitcherTests"
import { ProfileUpdateTests } from "./ProfileUpdateTests"
import { DemoArtifactLinter } from "./DemoArtifactLinter"

export function TestDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Organization System Tests</h1>
        <p className="text-muted-foreground">
          Testing free vs paid user behavior, profile updates, and demo artifact removal
        </p>
      </div>

      <div className="grid gap-6">
        <OrgSwitcherTests />
        <ProfileUpdateTests />
        <DemoArtifactLinter />
      </div>
    </div>
  )
}