import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, AlertTriangle, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConcurrencyData {
  current: number;
  limit: number;
  peak_this_month: number;
  percentage: number;
  warning_threshold: number;
  critical_threshold: number;
  status: 'ok' | 'warning' | 'critical';
}

interface ConcurrencyCardProps {
  concurrency: ConcurrencyData | null;
  loading?: boolean;
  onRefresh?: () => void;
  className?: string;
}

export function ConcurrencyCard({ concurrency, loading, onRefresh, className }: ConcurrencyCardProps) {
  if (loading) {
    return (
      <Card className={cn("p-6", className)}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-muted-foreground" />
            <Skeleton className="h-5 w-32" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
        
        <div className="space-y-4">
          <div className="flex justify-between text-sm">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-2 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Skeleton className="h-3 w-20 mb-1" />
              <Skeleton className="h-4 w-8" />
            </div>
            <div>
              <Skeleton className="h-3 w-24 mb-1" />
              <Skeleton className="h-4 w-8" />
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (!concurrency) {
    return (
      <Card className={cn("p-6", className)}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-medium">Concurrent Calls</h3>
          </div>
          <Badge variant="secondary">No Data</Badge>
        </div>
        
        <div className="text-center py-8 text-muted-foreground">
          <p>No concurrency data available</p>
          {onRefresh && (
            <Button variant="outline" size="sm" className="mt-2" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          )}
        </div>
      </Card>
    );
  }

  const getStatusIcon = () => {
    switch (concurrency.status) {
      case 'critical':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      default:
        return <CheckCircle className="h-4 w-4 text-success" />;
    }
  };

  const getStatusBadge = () => {
    switch (concurrency.status) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="text-warning">Warning</Badge>;
      default:
        return <Badge variant="secondary" className="text-success">Normal</Badge>;
    }
  };

  const getProgressColor = () => {
    switch (concurrency.status) {
      case 'critical':
        return 'bg-destructive';
      case 'warning':
        return 'bg-warning';
      default:
        return 'bg-primary';
    }
  };

  return (
    <Card className={cn("p-6 hover:bg-card-hover transition-colors", className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-medium">Concurrent Calls</h3>
        </div>
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          {getStatusBadge()}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">
              {concurrency.current} of {concurrency.limit} calls
            </span>
            <span className="font-medium">{concurrency.percentage}%</span>
          </div>
          
          <Progress 
            value={concurrency.percentage} 
            className={cn("h-2", `[&>[data-state]]:${getProgressColor()}`)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground mb-1">Current Active</p>
            <p className="text-2xl font-bold">{concurrency.current}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">Peak This Month</p>
            <p className="text-2xl font-bold">{concurrency.peak_this_month}</p>
          </div>
        </div>

        {concurrency.status !== 'ok' && (
          <div className={cn(
            "p-3 rounded-lg border",
            concurrency.status === 'critical' 
              ? "bg-destructive/10 border-destructive/20 text-destructive" 
              : "bg-warning/10 border-warning/20 text-warning"
          )}>
            <div className="flex items-start gap-2">
              {getStatusIcon()}
              <div className="flex-1">
                <p className="font-medium text-sm">
                  {concurrency.status === 'critical' 
                    ? 'Concurrency Limit Reached' 
                    : 'Approaching Concurrency Limit'}
                </p>
                <p className="text-xs opacity-90 mt-1">
                  {concurrency.status === 'critical'
                    ? 'New calls may be rejected. Consider upgrading your plan.'
                    : `You're using ${concurrency.percentage}% of your concurrent call limit.`}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center pt-2">
          <div className="text-xs text-muted-foreground">
            Thresholds: {concurrency.warning_threshold} warning, {concurrency.critical_threshold} critical
          </div>
          {onRefresh && (
            <Button variant="ghost" size="sm" onClick={onRefresh}>
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}