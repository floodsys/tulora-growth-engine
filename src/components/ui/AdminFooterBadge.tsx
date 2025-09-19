import { formatDistanceToNow } from 'date-fns';
import { ExternalLink } from 'lucide-react';
import { useSuperadmin } from '@/hooks/useSuperadmin';
import { getVersionInfoSync } from '@/lib/version';

export function AdminFooterBadge() {
  const { isSuperadmin } = useSuperadmin();
  
  if (!isSuperadmin) {
    return null;
  }

  const versionInfo = getVersionInfoSync();
  const shortSha = versionInfo.commit.substring(0, 8);
  const buildTime = new Date(versionInfo.buildTimestamp);
  const relativeTime = formatDistanceToNow(buildTime, { addSuffix: true });
  
  const repoUrl = import.meta.env.VITE_REPO_URL;
  const commitUrl = repoUrl ? `${repoUrl}/commit/${versionInfo.commit}` : null;

  return (
    <div 
      className="fixed bottom-4 right-4 z-50 bg-muted/80 backdrop-blur-sm border border-border rounded-lg px-3 py-2 text-xs text-muted-foreground"
      data-testid="admin-footer-badge"
    >
      <div className="flex items-center gap-2">
        <span>
          Commit{' '}
          {commitUrl ? (
            <a 
              href={commitUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              {shortSha}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <span className="font-mono">{shortSha}</span>
          )}
        </span>
        <span>·</span>
        <span>Build <span className="font-mono">{versionInfo.buildId}</span></span>
        <span>·</span>
        <span>{relativeTime}</span>
      </div>
    </div>
  );
}