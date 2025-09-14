import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Download, FileText, Calendar, Database, Shield, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface ExportAndIntegrationsSettingsProps {
  organizationId?: string;
}

interface ExportJob {
  id: string;
  type: 'calls' | 'transcripts' | 'analytics' | 'audit_logs';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  completed_at?: string;
  download_url?: string;
  file_size?: number;
  record_count?: number;
}

const mockExportJobs: ExportJob[] = [
  {
    id: '1',
    type: 'calls',
    status: 'completed',
    created_at: '2024-01-15T10:00:00Z',
    completed_at: '2024-01-15T10:05:00Z',
    download_url: '#',
    file_size: 2.5 * 1024 * 1024, // 2.5MB
    record_count: 1250
  },
  {
    id: '2',
    type: 'transcripts',
    status: 'completed',
    created_at: '2024-01-10T14:30:00Z',
    completed_at: '2024-01-10T14:45:00Z',
    download_url: '#',
    file_size: 5.8 * 1024 * 1024, // 5.8MB
    record_count: 890
  },
  {
    id: '3',
    type: 'analytics',
    status: 'processing',
    created_at: '2024-01-16T09:15:00Z'
  }
];

export function ExportAndIntegrationsSettings({ organizationId }: ExportAndIntegrationsSettingsProps) {
  const [exportJobs, setExportJobs] = useState<ExportJob[]>(mockExportJobs);
  const [selectedExportType, setSelectedExportType] = useState<string>('calls');
  const [selectedDateRange, setSelectedDateRange] = useState<string>('last_30_days');
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getExportTypeIcon = (type: string) => {
    switch (type) {
      case 'calls': return FileText;
      case 'transcripts': return FileText;
      case 'analytics': return Database;
      case 'audit_logs': return Shield;
      default: return FileText;
    }
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const handleExport = async () => {
    if (!organizationId) return;

    setExporting(true);
    
    try {
      // Simulate export initiation
      const newJob: ExportJob = {
        id: Date.now().toString(),
        type: selectedExportType as any,
        status: 'pending',
        created_at: new Date().toISOString()
      };

      setExportJobs(prev => [newJob, ...prev]);

      toast({
        title: "Export started",
        description: `Your ${selectedExportType} export has been queued and will be processed shortly.`,
      });

      // Simulate processing
      setTimeout(() => {
        setExportJobs(prev => prev.map(job => 
          job.id === newJob.id 
            ? { ...job, status: 'processing' }
            : job
        ));
      }, 2000);

      // Simulate completion
      setTimeout(() => {
        setExportJobs(prev => prev.map(job => 
          job.id === newJob.id 
            ? {
                ...job,
                status: 'completed',
                completed_at: new Date().toISOString(),
                download_url: '#',
                file_size: Math.random() * 10 * 1024 * 1024, // Random size up to 10MB
                record_count: Math.floor(Math.random() * 2000) + 100
              }
            : job
        ));

        toast({
          title: "Export completed",
          description: "Your export is ready for download.",
        });
      }, 8000);

    } catch (error) {
      console.error('Error starting export:', error);
      toast({
        title: "Export failed",
        description: "Failed to start export. Please try again.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleDownload = (job: ExportJob) => {
    if (!job.download_url) return;
    
    toast({
      title: "Download started",
      description: `Downloading ${job.type} export...`,
    });
    
    // In a real implementation, this would trigger the actual download
    // window.open(job.download_url, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Data Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Data Export
          </CardTitle>
          <CardDescription>
            Export your data for backup, analysis, or migration purposes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Type</label>
              <Select value={selectedExportType} onValueChange={setSelectedExportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="calls">Call Records</SelectItem>
                  <SelectItem value="transcripts">Call Transcripts</SelectItem>
                  <SelectItem value="analytics">Analytics Data</SelectItem>
                  <SelectItem value="audit_logs">Audit Logs</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date Range</label>
              <Select value={selectedDateRange} onValueChange={setSelectedDateRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last_7_days">Last 7 days</SelectItem>
                  <SelectItem value="last_30_days">Last 30 days</SelectItem>
                  <SelectItem value="last_90_days">Last 90 days</SelectItem>
                  <SelectItem value="last_year">Last year</SelectItem>
                  <SelectItem value="all_time">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Alert>
            <AlertDescription>
              Exports are generated in CSV format and include all relevant metadata. 
              Large exports may take several minutes to process.
            </AlertDescription>
          </Alert>

          <Button onClick={handleExport} disabled={exporting} className="w-full md:w-auto">
            {exporting ? "Starting Export..." : "Start Export"}
          </Button>
        </CardContent>
      </Card>

      {/* Export History */}
      <Card>
        <CardHeader>
          <CardTitle>Export History</CardTitle>
          <CardDescription>
            Download and manage your recent data exports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {exportJobs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No exports found. Start your first export above.
              </div>
            ) : (
              exportJobs.map((job) => {
                const Icon = getExportTypeIcon(job.type);
                return (
                  <div key={job.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium capitalize">
                          {job.type.replace('_', ' ')} Export
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Started {format(new Date(job.created_at), 'MMM d, yyyy h:mm a')}
                          {job.completed_at && (
                            <span> • Completed {format(new Date(job.completed_at), 'h:mm a')}</span>
                          )}
                        </div>
                        {job.status === 'completed' && job.record_count && (
                          <div className="text-xs text-muted-foreground">
                            {job.record_count.toLocaleString()} records • {formatFileSize(job.file_size || 0)}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Badge className={getStatusColor(job.status)}>
                        {job.status.toUpperCase()}
                      </Badge>
                      
                      {job.status === 'completed' && job.download_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(job)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Third-party Integrations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Third-party Integrations
          </CardTitle>
          <CardDescription>
            Connect your data to external platforms and services
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <div className="font-medium">Salesforce CRM</div>
                <div className="text-sm text-muted-foreground">
                  Sync call data and leads
                </div>
              </div>
              <Badge variant="secondary">Coming Soon</Badge>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <div className="font-medium">HubSpot</div>
                <div className="text-sm text-muted-foreground">
                  Integrate with HubSpot CRM
                </div>
              </div>
              <Badge variant="secondary">Coming Soon</Badge>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <div className="font-medium">Zapier</div>
                <div className="text-sm text-muted-foreground">
                  Connect to 3000+ apps
                </div>
              </div>
              <Badge variant="secondary">Coming Soon</Badge>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <div className="font-medium">Webhooks</div>
                <div className="text-sm text-muted-foreground">
                  Real-time data streaming
                </div>
              </div>
              <Badge variant="secondary">Coming Soon</Badge>
            </div>
          </div>

          <Alert>
            <AlertDescription>
              Integration features are coming soon. Contact support to discuss custom integration requirements.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* API Access */}
      <Card>
        <CardHeader>
          <CardTitle>API Access</CardTitle>
          <CardDescription>
            Programmatic access to your data via REST API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              API access is available for Pro and Enterprise plans. Generate API keys and view documentation in your account settings.
            </AlertDescription>
          </Alert>
          
          <Button variant="outline" className="w-full md:w-auto">
            <ExternalLink className="h-4 w-4 mr-2" />
            View API Documentation
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}