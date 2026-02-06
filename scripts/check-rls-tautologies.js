#!/usr/bin/env node

/**
 * RLS Regression Tripwire - SQL Tautology Detection
 *
 * Prevents future "user_id = user_id" tautologies and parameter shadowing
 * that can break Row-Level Security policies.
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dangerous patterns that indicate RLS issues
const DANGEROUS_PATTERNS = [
  {
    name: 'unqualified_user_id_tautology',
    regex: /\buser_id\s*=\s*user_id\b/gi,
    severity: 'critical',
    description: 'Unqualified user_id = user_id tautology (always true)'
  },
  {
    name: 'parameter_shadowing',
    regex: /\bp_user_id\s*=\s*p_user_id\b/gi,
    severity: 'critical',
    description: 'Parameter shadowing pattern (potentially always true)'
  },
  {
    name: 'auth_uid_tautology',
    regex: /\bauth\.uid\(\)\s*=\s*auth\.uid\(\)\b/gi,
    severity: 'critical',
    description: 'auth.uid() = auth.uid() tautology (always true)'
  },
  {
    name: 'using_expression_true',
    regex: /USING\s*\(\s*true\s*\)/gi,
    severity: 'high',
    description: 'RLS policy with USING (true) - allows all access'
  },
  {
    name: 'with_check_true',
    regex: /WITH\s+CHECK\s*\(\s*true\s*\)/gi,
    severity: 'high',
    description: 'RLS policy with WITH CHECK (true) - allows all inserts/updates'
  },
  {
    name: 'missing_table_qualification',
    regex: /SELECT.*FROM\s+(\w+).*WHERE.*\1\.user_id\s*=\s*user_id(?!\s*\))/gi,
    severity: 'medium',
    description: 'Potentially unqualified user_id in WHERE clause'
  }
];

let hasCritical = false;
let hasHighFindings = false;
let hasWarnings = false;
const findings = [];

function addFinding(severity, message, file, line, lineNumber, pattern) {
  const finding = {
    severity,
    message,
    file,
    line: line.trim(),
    lineNumber,
    pattern,
    timestamp: new Date().toISOString()
  };

  findings.push(finding);

  if (severity === 'critical') {
    hasCritical = true;
    console.error(`❌ ${severity.toUpperCase()}: ${message}`);
    console.error(`   File: ${file}:${lineNumber}`);
    console.error(`   Code: ${line.trim()}`);
    console.error('');
  } else if (severity === 'high') {
    hasHighFindings = true;
    console.warn(`⚠️  ${severity.toUpperCase()}: ${message}`);
    console.warn(`   File: ${file}:${lineNumber}`);
    console.warn(`   Code: ${line.trim()}`);
    console.warn('');
  } else {
    hasWarnings = true;
    console.warn(`⚠️  ${severity.toUpperCase()}: ${message}`);
    console.warn(`   File: ${file}:${lineNumber}`);
    console.warn(`   Code: ${line.trim()}`);
    console.warn('');
  }
}

// Lines that are clearly documentation/detection code, not actual vulnerabilities
const FALSE_POSITIVE_PATTERNS = [
  /LIKE\s*'%.*user_id\s*=\s*user_id.*%'/i,  // SQL LIKE patterns searching for tautologies
  /['"].*purpose.*['"].*['"].*prevent.*tautology/i,  // Documentation comments
  /comment.*tautology/i,  // Comments about tautologies
  /--.*user_id\s*=\s*user_id/i,  // SQL comments
  /\/\/.*user_id\s*=\s*user_id/i,  // JS comments
  /\/\*.*user_id\s*=\s*user_id.*\*\//i,  // Block comments
];

function isFalsePositive(line) {
  return FALSE_POSITIVE_PATTERNS.some(pattern => pattern.test(line));
}

function checkFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Skip false positives (documentation, comments, detection code)
      if (isFalsePositive(line)) {
        return;
      }

      DANGEROUS_PATTERNS.forEach(pattern => {
        const matches = line.matchAll(pattern.regex);
        for (const match of matches) {
          addFinding(
            pattern.severity,
            `${pattern.description} in ${path.basename(filePath)}`,
            filePath,
            line,
            index + 1,
            pattern.name
          );
        }
      });
    });
  } catch (error) {
    console.warn(`⚠️  Could not read file ${filePath}: ${error.message}`);
  }
}

async function checkSQLFiles() {
  console.log('🔍 Checking SQL files for RLS tautologies...');

  const sqlFiles = await glob('supabase/**/*.sql', {
    ignore: ['node_modules/**', 'dist/**', '.git/**']
  });

  sqlFiles.forEach(checkFile);

  if (sqlFiles.length === 0) {
    console.log('📝 No SQL files found to check');
  } else {
    console.log(`📝 Checked ${sqlFiles.length} SQL files`);
  }
}

async function checkEdgeFunctions() {
  console.log('🔍 Checking Edge Functions for RLS patterns...');

  const functionFiles = await glob('supabase/functions/**/index.ts', {
    ignore: ['node_modules/**', 'dist/**']
  });

  functionFiles.forEach(checkFile);

  console.log(`📝 Checked ${functionFiles.length} edge function files`);
}

async function checkSourceCode() {
  console.log('🔍 Checking source code for dangerous RLS patterns...');

  const sourceFiles = await glob('src/**/*.{ts,tsx,js,jsx}', {
    ignore: ['node_modules/**', 'dist/**']
  });

  sourceFiles.forEach(checkFile);

  console.log(`📝 Checked ${sourceFiles.length} source files`);
}

function generateReport() {
  const reportDir = path.join(__dirname, '..', 'test-results');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const report = {
    timestamp: new Date().toISOString(),
    test_type: 'rls_tautology_check',
    summary: {
      total_findings: findings.length,
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length
    },
    patterns_checked: DANGEROUS_PATTERNS.map(p => ({
      name: p.name,
      description: p.description,
      severity: p.severity
    })),
    findings
  };

  const reportPath = path.join(reportDir, 'rls-tautology-check.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`📊 Report saved to: ${reportPath}`);
  return report;
}

function printSummary(report) {
  console.log('\n📊 RLS Tautology Check Summary:');
  console.log('================================');

  if (report.summary.total_findings === 0) {
    console.log('✅ No dangerous RLS patterns found!');
  } else {
    console.log(`Total findings: ${report.summary.total_findings}`);
    console.log(`  Critical: ${report.summary.critical}`);
    console.log(`  High: ${report.summary.high}`);
    console.log(`  Medium: ${report.summary.medium}`);
    console.log(`  Low: ${report.summary.low}`);
  }

  if (hasCritical) {
    console.log('\n💥 CRITICAL ISSUES FOUND:');
    console.log('These patterns can completely bypass RLS security!');
    console.log('\n🛠️  Common fixes:');
    console.log('1. Qualify column names: table_name.user_id = auth.uid()');
    console.log('2. Avoid parameter shadowing: use different names');
    console.log('3. Replace USING (true) with proper conditions');
    console.log('4. Review all RLS policies for logic errors');
  } else if (hasHighFindings) {
    console.log('\n⚠️  HIGH SEVERITY FINDINGS (non-blocking):');
    console.log('Review these patterns - they may allow broader access than intended.');
    console.log('High findings do not fail the build but should be addressed.');
  }
}

async function main() {
  console.log('🚀 Starting RLS Tautology Check...\n');

  await checkSQLFiles();
  await checkEdgeFunctions();
  await checkSourceCode();

  const report = generateReport();
  printSummary(report);

  // Exit with error code ONLY if critical issues found
  // High severity findings are reported but do not fail the build
  if (hasCritical) {
    console.log('\n❌ Build FAILED: Critical RLS tautologies detected (critical_count > 0)');
    process.exit(1);
  } else if (hasHighFindings) {
    console.log('\n⚠️  High severity findings reported (non-blocking). Build continues.');
    process.exit(0);
  } else if (hasWarnings) {
    console.log('\n⚠️  Warnings found, but build can continue');
    process.exit(0);
  } else {
    console.log('\n✅ All RLS checks passed!');
    process.exit(0);
  }
}

// Run the check
main();

export { checkFile, checkSQLFiles, checkEdgeFunctions, checkSourceCode };
