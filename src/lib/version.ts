// Machine-readable version information utilities

import { COMMIT_SHA, BUILD_ID, BUILD_TIMESTAMP } from './build-info';

export interface VersionInfo {
  commit: string;
  buildId: string;
  buildTimestamp: string;
  env?: string;
}

/**
 * Fetches version information from public/version.json
 * Falls back to build-info.ts if unavailable
 */
export async function fetchVersionJson(): Promise<VersionInfo> {
  try {
    // Cache-busting with current build ID to ensure fresh fetch
    const currentBuildId = BUILD_ID;
    const cacheBustingUrl = `/version.json?v=${currentBuildId}&t=${Date.now()}`;
    
    const response = await fetch(cacheBustingUrl, {
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const versionInfo = await response.json();
    
    // Validate the structure
    if (!versionInfo.commit || !versionInfo.buildId || !versionInfo.buildTimestamp) {
      throw new Error('Invalid version.json structure');
    }
    
    return versionInfo;
  } catch (error) {
    console.warn('Failed to fetch version.json, falling back to build-info.ts:', error);
    
    // Fallback to build-info.ts
    return {
      commit: COMMIT_SHA,
      buildId: BUILD_ID,
      buildTimestamp: BUILD_TIMESTAMP,
      env: import.meta.env.MODE
    };
  }
}

/**
 * Gets version information synchronously from build-info.ts
 * Use this when you need immediate access without async
 */
export function getVersionInfoSync(): VersionInfo {
  return {
    commit: COMMIT_SHA,
    buildId: BUILD_ID,
    buildTimestamp: BUILD_TIMESTAMP,
    env: import.meta.env.MODE
  };
}