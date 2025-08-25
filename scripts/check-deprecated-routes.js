#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

/**
 * Lint script to prevent re-introduction of deprecated TeamsSettings.tsx
 * and duplicate /settings/teams routes
 */

// Configuration
const DEPRECATED_FILE = 'TeamsSettings.tsx';
const DEPRECATED_IMPORT_PATTERN = /import.*TeamsSettings.*from/;
const TOP_LEVEL_ROUTE_PATTERN = /<Route\s+path="\/settings\/teams"/;
const ALLOWLISTED_EXTENSIONS = ['.md', '.txt', '.json'];

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
  return ALLOWLISTED_EXTENSIONS.includes(ext);
}

function checkForDeprecatedFile() {
  console.log('🔍 Checking for deprecated TeamsSettings.tsx file...');
  
  const deprecatedFiles = glob.sync(`**/${DEPRECATED_FILE}`, {
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

function checkForDeprecatedImports() {
  console.log('🔍 Checking for deprecated TeamsSettings imports...');
  
  const sourceFiles = glob.sync('src/**/*.{ts,tsx,js,jsx}', {
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

function checkForTopLevelRoutes() {
  console.log('🔍 Checking for top-level /settings/teams routes...');
  
  const routeFiles = glob.sync('src/**/*.{ts,tsx,js,jsx}', {
    ignore: ['node_modules/**', 'dist/**']
  });

  routeFiles.forEach(file => {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        if (TOP_LEVEL_ROUTE_PATTERN.test(line)) {
          // Check if this is inside a nested Routes component by looking for SettingsLayout context
          const fileContent = content;
          const beforeLine = fileContent.substring(0, fileContent.indexOf(line));
          
          // If we find SettingsLayout or nested route structure before this line, it's probably OK
          const isNested = /SettingsLayout|element={<SettingsLayout/.test(beforeLine) ||
                          /<Route\s+path="\/settings"/.test(beforeLine);
          
          if (!isNested) {
            addError(
              `Top-level /settings/teams route found at line ${index + 1}: ${line.trim()}. Use nested route under SettingsLayout instead.`,
              file
            );
          }
        }
      });
    } catch (error) {
      addWarning(`Could not read file: ${error.message}`, file);
    }
  });

  console.log('✅ Route check completed');
}

function main() {
  console.log('🚀 Starting deprecated routes check...\n');
  
  checkForDeprecatedFile();
  checkForDeprecatedImports();
  checkForTopLevelRoutes();
  
  console.log('\n📊 Check Summary:');
  if (hasErrors) {
    console.log(`❌ Found ${errors.length} error(s):`);
    errors.forEach(error => console.log(`   - ${error}`));
    console.log('\n💡 To fix these issues:');
    console.log('   1. Remove any TeamsSettings.tsx files');
    console.log('   2. Remove imports of TeamsSettings component');
    console.log('   3. Use nested routes under SettingsLayout for /settings/teams');
    console.log('   4. Use only SettingsTeams.tsx for team management');
    process.exit(1);
  } else {
    console.log('✅ All checks passed! No deprecated routes or components found.');
    process.exit(0);
  }
}

// Run the check
if (require.main === module) {
  main();
}

module.exports = { checkForDeprecatedFile, checkForDeprecatedImports, checkForTopLevelRoutes };