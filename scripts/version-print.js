#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read build info from environment or fallback values
const COMMIT_SHA = process.env.VITE_COMMIT_SHA || 'unknown';
const BUILD_ID = process.env.VITE_BUILD_ID || `build-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
const BUILD_TIMESTAMP = process.env.VITE_BUILD_TIMESTAMP || new Date().toISOString();

// Get base URL from environment
const BASE_URL = process.env.VITE_BASE_URL || 'http://localhost:8080';

console.log('=== Embedded Version Info ===');
console.log(`COMMIT_SHA: ${COMMIT_SHA}`);
console.log(`BUILD_ID: ${BUILD_ID}`);
console.log(`BUILD_TIMESTAMP: ${BUILD_TIMESTAMP}`);
console.log('');

// Try to fetch version.json from the configured BASE_URL
async function fetchVersionJson() {
  try {
    const versionUrl = `${BASE_URL}/version.json`;
    console.log(`=== Remote Version Info (${versionUrl}) ===`);
    
    const response = await fetch(versionUrl, {
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const versionInfo = await response.json();
    console.log(`COMMIT_SHA: ${versionInfo.commit || 'missing'}`);
    console.log(`BUILD_ID: ${versionInfo.buildId || 'missing'}`);
    console.log(`BUILD_TIMESTAMP: ${versionInfo.buildTimestamp || 'missing'}`);
    console.log(`ENVIRONMENT: ${versionInfo.env || 'not specified'}`);
    
    // Compare versions
    console.log('');
    console.log('=== Version Comparison ===');
    const commitMatch = COMMIT_SHA === versionInfo.commit;
    const buildMatch = BUILD_ID === versionInfo.buildId;
    
    console.log(`Commit SHA Match: ${commitMatch ? '✅' : '❌'} (${commitMatch ? 'same' : 'different'})`);
    console.log(`Build ID Match: ${buildMatch ? '✅' : '❌'} (${buildMatch ? 'same' : 'different'})`);
    
    if (!commitMatch || !buildMatch) {
      console.log('⚠️  Version mismatch detected - new version may be available');
    } else {
      console.log('✅ Versions match - running latest deployed version');
    }
    
  } catch (error) {
    console.log(`Failed to fetch remote version: ${error.message}`);
    console.log('This is normal if the app is not deployed or BASE_URL is incorrect.');
  }
}

// Check if we're in a Node.js environment with fetch support
if (typeof fetch === 'undefined') {
  // Try to use node-fetch or similar, but don't fail if not available
  try {
    const { fetch: nodeFetch } = require('node-fetch');
    global.fetch = nodeFetch;
  } catch (e) {
    console.log('');
    console.log('=== Remote Version Info ===');
    console.log('Fetch not available - install node-fetch to check remote version');
    console.log(`Would check: ${BASE_URL}/version.json`);
    process.exit(0);
  }
}

fetchVersionJson().catch(console.error);