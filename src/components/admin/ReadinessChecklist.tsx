import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ReadinessCheck {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'warning' | 'checking';
  message: string;
  details?: string;
}

export function ReadinessChecklist() {
  const [checks, setChecks] = useState<ReadinessCheck[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const { toast } = useToast();

  const initialChecks: ReadinessCheck[] = [
    { id: 'resend_key', name: 'Resend API Key', status: 'checking', message: 'Checking...', details: '' },
    { id: 'email_config', name: 'Email Configuration', status: 'checking', message: 'Checking...', details: '' },
    { id: 'domain_verification', name: 'Domain Verification (SPF/DKIM)', status: 'checking', message: 'Checking...', details: '' },
    { id: 'dmarc_status', name: 'DMARC Policy', status: 'checking', message: 'Checking...', details: '' },
    { id: 'suitecrm_config', name: 'SuiteCRM v8 Configuration', status: 'checking', message: 'Checking...', details: '' },
    { id: 'suitecrm_token', name: 'SuiteCRM Token Test', status: 'checking', message: 'Checking...', details: '' },
    { id: 'crm_sync_enabled', name: 'CRM Sync Status', status: 'checking', message: 'Checking...', details: '' },
    { id: 'anti_spam', name: 'Anti-spam Protection', status: 'checking', message: 'Checking...', details: '' },
  ];

  useEffect(() => {
    runChecks();
  }, []);

  const runChecks = async () => {
    setIsChecking(true);
    setChecks(initialChecks);

    try {
      const { data, error } = await supabase.functions.invoke('readiness-check', {
        body: { checkAll: true }
      });

      if (error) {
        console.error('Readiness check error:', error);
        toast({
          title: "Readiness Check Failed",
          description: "Unable to run system checks. Please try again.",
          variant: "destructive"
        });
        
        // Set all checks to fail
        setChecks(prev => prev.map(check => ({
          ...check,
          status: 'fail' as const,
          message: 'Check failed - system error'
        })));
        return;
      }

      if (data?.checks) {
        setChecks(data.checks);
      }
    } catch (error) {
      console.error('Readiness check error:', error);
      toast({
        title: "System Check Error",
        description: "Failed to connect to readiness check service.",
        variant: "destructive"
      });
    } finally {
      setIsChecking(false);
    }
  };

  const getStatusIcon = (status: ReadinessCheck['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'fail':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'checking':
        return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <XCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: ReadinessCheck['status']) => {
    switch (status) {
      case 'pass':
        return <Badge variant="default" className="bg-green-100 text-green-800">✓ Pass</Badge>;
      case 'fail':
        return <Badge variant="destructive">✖ Fail</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">⚠ Warning</Badge>;
      case 'checking':
        return <Badge variant="outline">⏳ Checking</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const overallStatus = checks.length > 0 ? (
    checks.every(check => check.status === 'pass') ? 'all_pass' :
    checks.some(check => check.status === 'fail') ? 'has_failures' :
    'has_warnings'
  ) : 'checking';

  const getOverallBadge = () => {
    switch (overallStatus) {
      case 'all_pass':
        return <Badge className="bg-green-100 text-green-800">🎉 All Systems Ready</Badge>;
      case 'has_failures':
        return <Badge variant="destructive">❌ Issues Detected</Badge>;
      case 'has_warnings':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">⚠ Warnings Present</Badge>;
      default:
        return <Badge variant="outline">🔄 Checking...</Badge>;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2">
              📋 System Readiness Checklist
              {getOverallBadge()}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Verify all security, deliverability, and integration settings before going live
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showDetails ? 'Hide' : 'Show'} Details
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={runChecks}
              disabled={isChecking}
            >
              <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {checks.map((check) => (
            <div
              key={check.id}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {getStatusIcon(check.status)}
                <div className="space-y-1">
                  <div className="font-medium">{check.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {check.message}
                  </div>
                  {showDetails && check.details && (
                    <div className="text-xs text-muted-foreground mt-1 p-2 bg-muted rounded">
                      {check.details}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0">
                {getStatusBadge(check.status)}
              </div>
            </div>
          ))}
        </div>

        {overallStatus === 'all_pass' && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">System Ready for Production</span>
            </div>
            <p className="text-sm text-green-700 mt-1">
              All security and deliverability checks passed. Your contact system is ready for live traffic.
            </p>
          </div>
        )}

        {overallStatus === 'has_failures' && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-800">
              <XCircle className="h-5 w-5" />
              <span className="font-medium">Critical Issues Detected</span>
            </div>
            <p className="text-sm text-red-700 mt-1">
              Please resolve all failed checks before enabling contact forms in production.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}