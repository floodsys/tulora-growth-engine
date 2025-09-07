import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useProductLineGating } from "@/hooks/useProductLineGating";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

interface ProductLineGatingDemoProps {
  orgId: string | null;
}

export const ProductLineGatingDemo = ({ orgId }: ProductLineGatingDemoProps) => {
  const {
    entitlements,
    loading,
    error,
    isSubscribed,
    hasFeature,
    getLimits,
    getPlanKey,
    getPlanName
  } = useProductLineGating(orgId);

  if (!orgId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Product Line Gating Demo</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No organization selected</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Product Line Gating Demo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading entitlements...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Product Line Gating Demo</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Error: {error}</p>
        </CardContent>
      </Card>
    );
  }

  const leadGenSubscribed = isSubscribed('leadgen');
  const supportSubscribed = isSubscribed('support');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Product Line Entitlements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Lead Gen Section */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                AI Lead Gen
                {leadGenSubscribed ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-gray-400" />
                )}
              </h3>
              {leadGenSubscribed && (
                <Badge variant="secondary">
                  {getPlanName('leadgen')}
                </Badge>
              )}
            </div>
            
            {leadGenSubscribed ? (
              <div className="space-y-2 text-sm">
                <div><strong>Plan:</strong> {getPlanKey('leadgen')}</div>
                <div><strong>Features:</strong> {entitlements.leadgen?.features.join(', ') || 'None'}</div>
                <div><strong>Limits:</strong> 
                  <ul className="list-disc list-inside ml-4 mt-1">
                    {Object.entries(getLimits('leadgen')).map(([key, value]) => (
                      <li key={key}>{key}: {JSON.stringify(value)}</li>
                    ))}
                  </ul>
                </div>
                
                {/* Feature checks */}
                <div className="pt-2">
                  <strong>Feature Checks:</strong>
                  <ul className="list-disc list-inside ml-4 mt-1">
                    <li>Voice Calls: {hasFeature('leadgen', 'voice_calls') ? '✅' : '❌'}</li>
                    <li>Analytics: {hasFeature('leadgen', 'analytics') ? '✅' : '❌'}</li>
                    <li>Advanced Routing: {hasFeature('leadgen', 'advanced_routing') ? '✅' : '❌'}</li>
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Not subscribed to Lead Gen</p>
            )}
          </div>

          {/* Support Section */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                AI Phone Support
                {supportSubscribed ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-gray-400" />
                )}
              </h3>
              {supportSubscribed && (
                <Badge variant="secondary">
                  {getPlanName('support')}
                </Badge>
              )}
            </div>
            
            {supportSubscribed ? (
              <div className="space-y-2 text-sm">
                <div><strong>Plan:</strong> {getPlanKey('support')}</div>
                <div><strong>Features:</strong> {entitlements.support?.features.join(', ') || 'None'}</div>
                <div><strong>Limits:</strong> 
                  <ul className="list-disc list-inside ml-4 mt-1">
                    {Object.entries(getLimits('support')).map(([key, value]) => (
                      <li key={key}>{key}: {JSON.stringify(value)}</li>
                    ))}
                  </ul>
                </div>
                
                {/* Feature checks */}
                <div className="pt-2">
                  <strong>Feature Checks:</strong>
                  <ul className="list-disc list-inside ml-4 mt-1">
                    <li>Knowledge Base: {hasFeature('support', 'knowledge_base') ? '✅' : '❌'}</li>
                    <li>Ticket Routing: {hasFeature('support', 'ticket_routing') ? '✅' : '❌'}</li>
                    <li>SLA Management: {hasFeature('support', 'sla_management') ? '✅' : '❌'}</li>
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Not subscribed to Phone Support</p>
            )}
          </div>

          {/* Raw Data */}
          <details className="mt-4">
            <summary className="cursor-pointer font-medium text-sm">Raw Entitlements Data</summary>
            <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">
              {JSON.stringify(entitlements, null, 2)}
            </pre>
          </details>
        </CardContent>
      </Card>
    </div>
  );
};