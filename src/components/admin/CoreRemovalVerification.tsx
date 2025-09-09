import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronRight, Code2, Database, Eye } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { callEdge } from "@/lib/callEdge";

interface VerificationCheck {
  id: string;
  label: string;
  status: 'checking' | 'success' | 'warning' | 'error';
  message: string;
  details: string[];
  icon: React.ComponentType<{ className?: string }>;
}

export function CoreRemovalVerification() {
  const [checks, setChecks] = useState<VerificationCheck[]>([
    {
      id: 'core_plans_hidden',
      label: 'Core plans hidden',
      status: 'checking',
      message: 'Checking for active Core plans...',
      details: [],
      icon: Eye
    },
    {
      id: 'only_leadgen_support_active',
      label: 'Only leadgen/support plans active',
      status: 'checking',
      message: 'Verifying active plan types...',
      details: [],
      icon: Database
    },
    {
      id: 'no_core_code_references',
      label: 'No code references to product_line=\'core\'',
      status: 'checking',
      message: 'Scanning codebase for Core references...',
      details: [],
      icon: Code2
    }
  ]);
  
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    runVerification();
  }, []);

  const runVerification = async () => {
    setLoading(true);
    
    try {
      const { data, error } = await callEdge('admin-core-verification');
      
      if (error) {
        throw new Error(error.message || 'Verification failed');
      }
      
      setChecks(prev => prev.map(check => {
        const result = data.checks.find((c: any) => c.id === check.id);
        return result ? { ...check, ...result } : check;
      }));
      
    } catch (error) {
      console.error('Error running verification:', error);
      setChecks(prev => prev.map(check => ({
        ...check,
        status: 'error' as const,
        message: 'Verification failed',
        details: ['Unable to connect to verification service']
      })));
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (checkId: string) => {
    setExpanded(prev => ({
      ...prev,
      [checkId]: !prev[checkId]
    }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <div className="h-5 w-5 border-2 border-muted rounded-full animate-pulse" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-600 hover:bg-green-700">PASSED</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">WARNING</Badge>;
      case 'error':
        return <Badge variant="destructive">FAILED</Badge>;
      default:
        return <Badge variant="outline">CHECKING</Badge>;
    }
  };

  const allPassed = checks.every(check => check.status === 'success');
  const hasWarnings = checks.some(check => check.status === 'warning');
  const hasErrors = checks.some(check => check.status === 'error');

  return (
    <Card className={`border-l-4 ${
      allPassed ? 'border-l-green-500 bg-green-50 dark:bg-green-950' : 
      hasErrors ? 'border-l-red-500 bg-red-50 dark:bg-red-950' :
      hasWarnings ? 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950' :
      'border-l-blue-500 bg-blue-50 dark:bg-blue-950'
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-3">
            {allPassed ? (
              <CheckCircle className="h-6 w-6 text-green-500" />
            ) : hasErrors ? (
              <XCircle className="h-6 w-6 text-red-500" />
            ) : hasWarnings ? (
              <AlertTriangle className="h-6 w-6 text-yellow-500" />
            ) : (
              <div className="h-6 w-6 border-2 border-primary rounded-full animate-pulse" />
            )}
            <span>Core Plan Removal Verification</span>
          </CardTitle>
          <div className="flex items-center space-x-2">
            {allPassed && (
              <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                ALL CHECKS PASSED
              </Badge>
            )}
            <Button 
              variant="outline" 
              size="sm"
              onClick={runVerification}
              disabled={loading}
            >
              {loading ? "Checking..." : "Re-run"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {checks.map((check) => {
          const Icon = check.icon;
          return (
            <div key={check.id} className="border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {getStatusIcon(check.status)}
                  <div>
                    <span className="font-medium text-sm">{check.label}</span>
                    <p className="text-xs text-muted-foreground">{check.message}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(check.status)}
                  {check.details.length > 0 && (
                    <Collapsible 
                      open={expanded[check.id]} 
                      onOpenChange={() => toggleExpanded(check.id)}
                    >
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm">
                          {expanded[check.id] ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </Collapsible>
                  )}
                </div>
              </div>
              
              {check.details.length > 0 && (
                <Collapsible 
                  open={expanded[check.id]} 
                  onOpenChange={() => toggleExpanded(check.id)}
                >
                  <CollapsibleContent>
                    <div className="mt-3 pt-3 border-t">
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div className="font-medium mb-2">Details:</div>
                        {check.details.map((detail, index) => (
                          <div key={index} className="font-mono bg-muted rounded px-2 py-1">
                            {detail}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          );
        })}
        
        {!loading && !allPassed && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> Some checks failed or show warnings. Review the details above 
              to ensure Core plans have been completely removed from the system.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}