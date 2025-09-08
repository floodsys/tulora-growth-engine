import { ReadinessChecklist } from "@/components/admin/ReadinessChecklist";
import { LeadsDataViewer } from "@/components/admin/LeadsDataViewer";
import { SecurityGuardrails } from "@/components/admin/SecurityGuardrails";

export default function AdminContactSettings() {
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Page Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            Contact System Administration
          </h1>
          <p className="text-muted-foreground">
            Monitor system readiness, manage leads, and ensure security compliance
          </p>
        </div>

        {/* Readiness Checklist */}
        <ReadinessChecklist />

        {/* Security Guardrails */}
        <SecurityGuardrails />

        {/* Leads Management */}
        <LeadsDataViewer />
      </main>
    </div>
  );
}