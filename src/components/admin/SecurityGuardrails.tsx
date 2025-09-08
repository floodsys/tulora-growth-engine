import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, AlertTriangle, Shield, Lock, Eye } from "lucide-react";

export function SecurityGuardrails() {
  const securityFeatures = [
    {
      name: "No Secrets in Client Code",
      status: "active",
      description: "All API keys and secrets are stored securely in Supabase edge functions",
      icon: <Lock className="h-4 w-4" />
    },
    {
      name: "PII Redaction in Logs",
      status: "active", 
      description: "Email addresses, names, and sensitive data are never logged",
      icon: <Eye className="h-4 w-4" />
    },
    {
      name: "Honeypot Protection",
      status: "active",
      description: "Hidden fields catch and silently block bot submissions",
      icon: <Shield className="h-4 w-4" />
    },
    {
      name: "Submit Delay",
      status: "active",
      description: "3-second minimum delay prevents rapid automated submissions",
      icon: <Shield className="h-4 w-4" />
    },
    {
      name: "Rate Limiting",
      status: "active", 
      description: "5 submissions per minute per IP address maximum",
      icon: <Shield className="h-4 w-4" />
    },
    {
      name: "Input Validation",
      status: "active",
      description: "Server-side validation prevents malicious payloads",
      icon: <CheckCircle className="h-4 w-4" />
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🛡️ Security & Privacy Guardrails
          <Badge className="bg-green-100 text-green-800">All Active</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>Security Status:</strong> All protective measures are active and monitoring form submissions.
              No user data or secrets are exposed to client-side code.
            </AlertDescription>
          </Alert>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {securityFeatures.map((feature) => (
              <div
                key={feature.name}
                className="flex items-start gap-3 p-3 border rounded-lg bg-green-50/50"
              >
                <div className="flex-shrink-0 mt-0.5 text-green-600">
                  {feature.icon}
                </div>
                <div className="space-y-1">
                  <div className="font-medium text-green-800">{feature.name}</div>
                  <div className="text-sm text-green-700">{feature.description}</div>
                </div>
                <div className="flex-shrink-0">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2">Data Protection Summary</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• All form submissions are logged with lead IDs only - no personal information</li>
              <li>• API keys and secrets are stored securely in Supabase and never exposed to frontend</li>
              <li>• Rate limiting prevents abuse while allowing legitimate usage</li>
              <li>• Honeypot fields and submission delays catch automated bot traffic</li>
              <li>• Email delivery tracking uses message IDs, not content</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}