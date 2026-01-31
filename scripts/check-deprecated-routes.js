#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Lint script to prevent re-introduction of deprecated TeamsSettings.tsx
 * and usage of the old /settings/teams route (except in redirect component)
 */

// Configuration
const DEPRECATED_FILE = 'TeamsSettings.tsx';
const DEPRECATED_IMPORT_PATTERN = /import.*TeamsSettings.*from/;
const DEPRECATED_ROUTE_USAGE = /\/settings\/teams(?!.*RedirectToOrganizationTeam)/;
const ALLOWLISTED_EXTENSIONS = ['.md', '.txt', '.json'];
const ALLOWLISTED_FILES = ['RedirectToOrganizationTeam.tsx', 'check-deprecated-routes.js', 'TeamsConsolidationTests.tsx'];

let hasErrors = false;
const errors = [];

function addError(message, file = null) {
  hasErrors = true;
  const errorMsg = file ? `${file}: ${message}` : message;
  errors.push(errorMsg);
  console.error(`❌ ${errorMsg}`);
}

function addWarning(message, file = null) {
  const warningMsg = file ? `${file}: ${message}` : message;
  console.warn(`⚠️  ${warningMsg}`);
}

function isAllowlistedFile(filePath) {
  const ext = path.extname(filePath);
  const fileName = path.basename(filePath);
  return ALLOWLISTED_EXTENSIONS.includes(ext) || ALLOWLISTED_FILES.includes(fileName);
}

async function checkForDeprecatedFile() {
  console.log('🔍 Checking for deprecated TeamsSettings.tsx file...');

  const deprecatedFiles = await glob(`**/${DEPRECATED_FILE}`, {
    ignore: ['node_modules/**', 'dist/**', '.git/**']
  });

  deprecatedFiles.forEach(file => {
    if (!isAllowlistedFile(file)) {
      addError(`Deprecated file ${DEPRECATED_FILE} found`, file);
    } else {
      addWarning(`Deprecated file found in allowlisted documentation`, file);
    }
  });

  if (deprecatedFiles.length === 0) {
    console.log('✅ No deprecated TeamsSettings.tsx files found');
  }
}

async function checkForDeprecatedImports() {
  console.log('🔍 Checking for deprecated TeamsSettings imports...');

  const sourceFiles = await glob('src/**/*.{ts,tsx,js,jsx}', {
    ignore: ['node_modules/**', 'dist/**']
  });

  sourceFiles.forEach(file => {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (DEPRECATED_IMPORT_PATTERN.test(line)) {
          addError(
            `Deprecated TeamsSettings import found at line ${index + 1}: ${line.trim()}`,
            file
          );
        }
      });
    } catch (error) {
      addWarning(`Could not read file: ${error.message}`, file);
    }
  });

  console.log('✅ Import check completed');
}

async function checkForDeprecatedRouteUsage() {
  console.log('🔍 Checking for deprecated /settings/teams usage...');

  const sourceFiles = await glob('src/**/*.{ts,tsx,js,jsx}', {
    ignore: ['node_modules/**', 'dist/**']
  });

  sourceFiles.forEach(file => {
    if (isAllowlistedFile(file)) {
      return; // Skip allowlisted files
    }

    try {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (DEPRECATED_ROUTE_USAGE.test(line)) {
          addError(
            `Deprecated /settings/teams route usage found at line ${index + 1}: ${line.trim()}. Use /settings/organization/team instead.`,
            file
          );
        }
      });
    } catch (error) {
      addWarning(`Could not read file: ${error.message}`, file);
    }
  });

  console.log('✅ Route usage check completed');
}

async function main() {
  console.log('🚀 Starting deprecated routes check...\n');

  await checkForDeprecatedFile();
  await checkForDeprecatedImports();
  await checkForDeprecatedRouteUsage();

  console.log('\n📊 Check Summary:');
  if (hasErrors) {
    console.log(`❌ Found ${errors.length} error(s):`);
    errors.forEach(error => console.log(`   - ${error}`));
    console.log('\n💡 To fix these issues:');
    console.log('   1. Remove any TeamsSettings.tsx files');
    console.log('   2. Remove imports of TeamsSettings component');
    console.log('   3. Replace /settings/teams usage with /settings/organization/team');
    console.log('   4. Use only the Team tab in Organization settings');
    process.exit(1);
  } else {
    console.log('✅ All checks passed! No deprecated routes or components found.');
    process.exit(0);
  }
}

// Run the check
main();

export { checkForDeprecatedFile, checkForDeprecatedImports, checkForDeprecatedRouteUsage };
