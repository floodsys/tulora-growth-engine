import { useAccessDiagnostics, AccessDiagnostics } from '@/hooks/useAccessDiagnostics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, ExternalLink, Shield, User, UserCheck, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

interface SaveFailureDiagnosticsProps {
  organizationId: string;
  show: boolean;
  onClose: () => void;
}

function getFixSuggestions(diagnostics: AccessDiagnostics): Array<{
  type: 'contact_owner' | 'activate_seat' | 'role_upgrade' | 'debug';
  title: string;
  description: string;
  action?: {
    text: string;
    href: string;
  };
}> {
  const suggestions = [];

  // If not a member at all
  if (!diagnostics.role && !diagnostics.is_owner) {
    suggestions.push({
      type: 'contact_owner' as const,
      title: 'Not a member of this organization',
      description: 'You need to be invited to this organization by an owner or admin.',
      action: {
        text: 'Contact Organization Owner',
        href: '#'
      }
    });
  }

  // If member but seat inactive
  if (diagnostics.role && diagnostics.seat_active === false) {
    suggestions.push({
      type: 'activate_seat' as const,
      title: 'Activate your seat',
      description: 'Your organization membership exists but your seat is inactive. Ask an admin to activate your seat.',
      action: {
        text: 'Contact Admin for Seat Activation',
        href: '#'
      }
    });
  }

  // If member but not admin/owner role
  if (diagnostics.role && diagnostics.role !== 'admin' && !diagnostics.is_owner) {
    suggestions.push({
      type: 'role_upgrade' as const,
      title: 'Admin role required',
      description: `Your current role "${diagnostics.role}" doesn't have permission to edit organization settings. Ask an owner to upgrade your role to "admin".`,
      action: {
        text: 'Contact Owner for Admin Role',
        href: '#'
      }
    });
  }

  // Always add debug option
  suggestions.push({
    type: 'debug' as const,
    title: 'Debug access issues',
    description: 'Use the admin diagnostic tools to investigate and test your permissions.',
    action: {
      text: 'Open Diagnostic Tools',
      href: '/admin?tab=diagnostics'
    }
  });

  return suggestions;
}

function AccessStatusBadge({ label, value, positive }: { 
  label: string; 
  value: boolean | string | null; 
  positive?: boolean;
}) {
  const getVariant = () => {
    if (value === null || value === '') return 'secondary';
    if (positive !== undefined) {
      return (positive === Boolean(value)) ? 'default' : 'destructive';
    }
    return Boolean(value) ? 'default' : 'destructive';
  };

  const displayValue = () => {
    if (value === null) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return value.toString();
  };

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}:</span>
      <Badge variant={getVariant()} className="font-mono text-xs">
        {displayValue()}
      </Badge>
    </div>
  );
}

export function SaveFailureDiagnostics({ organizationId, show, onClose }: SaveFailureDiagnosticsProps) {
  const { diagnostics, loading, error, fetchDiagnostics } = useAccessDiagnostics();

  if (!show) return null;

  const handleRunDiagnostics = () => {
    fetchDiagnostics(organizationId);
  };

  const fixSuggestions = diagnostics ? getFixSuggestions(diagnostics) : [];
  const hasAccess = diagnostics?.check_admin_access || false;

  return (
    <Card className="border-destructive bg-destructive/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Save Blocked - Access Denied
        </CardTitle>
        <CardDescription>
          Your organization settings save was denied. Let's diagnose why and suggest fixes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!diagnostics && !loading && !error && (
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Click "Run Diagnostics" to analyze your permissions and get specific fix suggestions.
            </AlertDescription>
          </Alert>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></div>
            <span>Analyzing your permissions...</span>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to fetch diagnostics: {error}
            </AlertDescription>
          </Alert>
        )}

        {diagnostics && (
          <div className="space-y-4">
            {/* Access Summary */}
            <div className="flex items-center gap-2 p-3 rounded-md bg-muted">
              <UserCheck className={`h-5 w-5 ${hasAccess ? 'text-green-600' : 'text-red-600'}`} />
              <span className="font-medium">
                Access Status: {hasAccess ? '✅ Authorized' : '❌ Denied'}
              </span>
            </div>

            {/* Detailed Permissions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Membership Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <AccessStatusBadge label="Role" value={diagnostics.role || 'none'} />
                  <AccessStatusBadge label="Seat Active" value={diagnostics.seat_active} positive={true} />
                  <AccessStatusBadge label="Is Owner" value={diagnostics.is_owner} positive={true} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Function Results
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <AccessStatusBadge 
                    label="check_admin_access()" 
                    value={diagnostics.check_admin_access} 
                    positive={true} 
                  />
                  <div className="text-xs text-muted-foreground mt-2">
                    This is the definitive access check used by the database.
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Fix Suggestions */}
            {fixSuggestions.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium">How to fix this:</h4>
                {fixSuggestions.map((suggestion, index) => (
                  <Alert key={index} className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20">
                    <AlertDescription className="space-y-2">
                      <div className="font-medium text-blue-900 dark:text-blue-100">
                        {suggestion.title}
                      </div>
                      <div className="text-blue-700 dark:text-blue-300">
                        {suggestion.description}
                      </div>
                      {suggestion.action && (
                        <div>
                          {suggestion.action.href.startsWith('/') ? (
                            <Button 
                              asChild 
                              variant="outline" 
                              size="sm"
                              className="border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900"
                            >
                              <Link to={suggestion.action.href} className="flex items-center gap-2">
                                {suggestion.action.text}
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            </Button>
                          ) : (
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900"
                              onClick={() => {
                                // Could trigger email/notification in the future
                                alert('Contact functionality not implemented yet');
                              }}
                            >
                              {suggestion.action.text}
                            </Button>
                          )}
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={handleRunDiagnostics} disabled={loading}>
            {loading ? 'Running...' : 'Run Diagnostics'}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}