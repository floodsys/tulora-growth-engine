import { Shield, Server, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface AdminModeChipProps {
  environment?: string;
  className?: string;
}

export function AdminModeChip({ 
  environment = 'unknown',
  className 
}: AdminModeChipProps) {
  const getEnvironmentColor = () => {
    switch (environment.toLowerCase()) {
      case 'production':
      case 'prod':
        return 'bg-destructive text-destructive-foreground';
      case 'staging':
      case 'stage':
        return 'bg-warning text-warning-foreground';
      case 'development':
      case 'dev':
      case 'local':
        return 'bg-primary text-primary-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getIcon = () => {
    switch (environment.toLowerCase()) {
      case 'production':
      case 'prod':
        return <AlertTriangle className="h-3 w-3" />;
      case 'staging':
      case 'stage':
        return <Server className="h-3 w-3" />;
      default:
        return <Shield className="h-3 w-3" />;
    }
  };

  return (
    <Badge 
      variant="secondary" 
      className={`
        flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md
        ${getEnvironmentColor()}
        ${className}
      `}
    >
      {getIcon()}
      Admin Mode
      <span className="opacity-80">({environment})</span>
    </Badge>
  );
}