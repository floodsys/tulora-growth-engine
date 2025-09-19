import { useEffect, useState } from 'react';
import { fetchVersionJson, getVersionInfoSync } from '@/lib/version';
import { toast } from '@/hooks/use-toast';
import { forceReload } from '@/lib/build-info';

export interface VersionMismatch {
  currentCommit: string;
  latestCommit: string;
  currentBuildId: string;
  latestBuildId: string;
}

export function useVersionNotifier() {
  const [versionMismatch, setVersionMismatch] = useState<VersionMismatch | null>(null);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const checkVersion = async () => {
      try {
        const currentVersion = getVersionInfoSync();
        const latestVersion = await fetchVersionJson();

        // Compare commit SHA and build ID
        if (
          currentVersion.commit !== latestVersion.commit ||
          currentVersion.buildId !== latestVersion.buildId
        ) {
          const mismatch = {
            currentCommit: currentVersion.commit,
            latestCommit: latestVersion.commit,
            currentBuildId: currentVersion.buildId,
            latestBuildId: latestVersion.buildId,
          };

          setVersionMismatch(mismatch);

          // Log telemetry (no PII)
          console.info('version_mismatch_detected', {
            current_commit: currentVersion.commit.substring(0, 8),
            latest_commit: latestVersion.commit.substring(0, 8),
            current_build: currentVersion.buildId.substring(0, 8),
            latest_build: latestVersion.buildId.substring(0, 8),
          });

          // Show toast notification
          toast({
            title: "New version available",
            description: "A newer version of the app is available.",
            duration: 0, // Don't auto-dismiss
          });
        }
      } catch (error) {
        console.warn('Failed to check for version updates:', error);
      }
    };

    // Check immediately on mount
    checkVersion();

    // Check every 5 minutes
    const intervalId = setInterval(checkVersion, 5 * 60 * 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  return { versionMismatch };
}