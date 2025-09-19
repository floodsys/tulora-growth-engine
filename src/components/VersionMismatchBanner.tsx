import { AlertTriangle, RefreshCw } from 'lucide-react';
import { forceReload } from '@/lib/build-info';
import { VersionMismatch } from '@/hooks/useVersionNotifier';

interface VersionMismatchBannerProps {
  versionMismatch: VersionMismatch;
  isSuperadmin?: boolean;
}

export function VersionMismatchBanner({ versionMismatch, isSuperadmin }: VersionMismatchBannerProps) {
  if (!versionMismatch) return null;

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-2 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <span className="text-sm text-yellow-800 dark:text-yellow-200">
              New version available
            </span>
            {isSuperadmin && (
              <span className="text-xs text-yellow-600 dark:text-yellow-400 font-mono">
                {versionMismatch.currentCommit.substring(0, 8)} → {versionMismatch.latestCommit.substring(0, 8)}
              </span>
            )}
          </div>
          
          <button
            onClick={() => forceReload()}
            className="flex items-center space-x-1 px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Reload</span>
          </button>
        </div>
      </div>
    </div>
  );
}