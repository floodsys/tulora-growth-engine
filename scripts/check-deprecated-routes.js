#!/usr/bin/env node

/**
 * Lint script to check for deprecated invite routes
 * Fails CI if "accept-new" appears in code or content (except allowed files)
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Files that are allowed to contain "accept-new" (for redirect functionality)
const ALLOWED_FILES = [
  'src/components/InviteAcceptRedirect.tsx', // Redirect component needs to reference old route
  'scripts/check-deprecated-routes.js', // This script itself
];

// Patterns to search for
const DEPRECATED_PATTERNS = [
  'accept-new',
  'invite/accept-new'
];

function checkFile(filePath) {
  // Skip if this is an allowed file
  if (ALLOWED_FILES.includes(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const violations = [];

  DEPRECATED_PATTERNS.forEach(pattern => {
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (line.includes(pattern)) {
        violations.push({
          file: filePath,
          line: index + 1,
          pattern,
          content: line.trim()
        });
      }
    });
  });

  return violations;
}

function main() {
  console.log('🔍 Checking for deprecated invite routes...');

  // Get all files to check
  const files = glob.sync('**/*', {
    ignore: [
      'node_modules/**',
      '.git/**',
      'dist/**',
      'build/**',
      '*.lock',
      '*.log'
    ]
  }).filter(file => {
    const stat = fs.statSync(file);
    return stat.isFile() && (
      file.endsWith('.ts') ||
      file.endsWith('.tsx') ||
      file.endsWith('.js') ||
      file.endsWith('.jsx') ||
      file.endsWith('.md') ||
      file.endsWith('.html') ||
      file.endsWith('.json')
    );
  });

  let totalViolations = 0;
  const allViolations = [];

  files.forEach(file => {
    try {
      const violations = checkFile(file);
      if (violations.length > 0) {
        allViolations.push(...violations);
        totalViolations += violations.length;
      }
    } catch (error) {
      // Skip files that can't be read
    }
  });

  if (totalViolations > 0) {
    console.error('❌ Found deprecated invite route references:');
    console.error('');
    
    allViolations.forEach(violation => {
      console.error(`${violation.file}:${violation.line}`);
      console.error(`  Pattern: "${violation.pattern}"`);
      console.error(`  Content: ${violation.content}`);
      console.error('');
    });

    console.error(`Total violations: ${totalViolations}`);
    console.error('');
    console.error('Please replace all "accept-new" references with "/invite/accept"');
    process.exit(1);
  }

  console.log('✅ No deprecated invite routes found');
}

main();