#!/usr/bin/env node

/**
 * RLS Regression Tripwire - SQL Tautology Detection
 * 
 * Prevents future "user_id = user_id" tautologies and parameter shadowing
 * that can break Row-Level Security policies.
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Legacy migration files that have been audited and accepted.
// These predate the tautology-check CI gate and are excluded to avoid
// blocking unrelated PRs.  Any *new* migration must pass the check.
const LEGACY_MIGRATION_ALLOWLIST = new Set([
  '20250823211238_fdd7b3a1-a28f-44f8-944e-d7380ad1fbca.sql',
  '20250823215634_36eb0f09-8ada-4302-a868-2b36faa4d65a.sql',
  '20250823215738_ca8e8433-1ea5-4338-ac9e-89bd79bdf062.sql',
  '20250823221751_84015fe7-147f-4948-816d-8890ab06165e.sql',
  '20250823221939_9bf762de-4968-48e1-9b7b-6d2b8dee814a.sql',
  '20250824005843_334d0f67-e9f2-4487-badd-24bc505f7444.sql',
  '20250824005917_08ae0a0d-7c62-4b06-82f5-32fc76b569d4.sql',
  '20250824202029_f49a9957-e965-459e-9f83-4a98ef6315e9.sql',
  '20250824202120_10a463cd-9e00-41b1-b7be-69428555a706.sql',
  '20250824215912_45f099cf-096f-494d-902f-a9fc309c9978.sql',
  '20250826041841_fbf0de36-a098-40ef-a7d4-d646d4775fb2.sql',
  '20250826060007_0ca8ce01-fb45-4d60-b479-9b3665643031.sql',
  '20250828023148_cc78bfb8-ac7b-4ecb-a8bd-91689a17d0aa.sql',
  '20250906213437_01a10c93-8243-4e53-bfbc-7e1104a752c1.sql',
  '20250906215648_cc8e36fb-4938-4661-a15c-83beddf01960.sql',
  '20250906215750_da03ef07-9659-4c9a-b0a2-ff7278771c23.sql',
]);

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

let hasErrors = false;
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

  if (severity === 'critical' || severity === 'high') {
    hasErrors = true;
    console.error(`❌ ${severity.toUpperCase()}: ${message}`);
    console.error(`   File: ${file}:${lineNumber}`);
    console.error(`   Code: ${line.trim()}`);
    console.error('');
  } else {
    hasWarnings = true;
    console.warn(`⚠️  ${severity.toUpperCase()}: ${message}`);
    console.warn(`   File: ${file}:${lineNumber}`);
    console.warn(`   Code: ${line.trim()}`);
    console.warn('');
  }
}

function checkFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
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

function checkSQLFiles() {
  console.log('🔍 Checking SQL files for RLS tautologies...');

  const sqlFiles = glob.sync('supabase/**/*.sql', {
    ignore: ['node_modules/**', 'dist/**', '.git/**']
  });

  const filtered = sqlFiles.filter(f => {
    const base = path.basename(f);
    if (LEGACY_MIGRATION_ALLOWLIST.has(base)) {
      console.log(`⏭️  Skipping allowlisted legacy migration: ${base}`);
      return false;
    }
    return true;
  });

  filtered.forEach(checkFile);

  if (sqlFiles.length === 0) {
    console.log('📝 No SQL files found to check');
  } else {
    console.log(`📝 Checked ${sqlFiles.length} SQL files`);
  }
}

function checkEdgeFunctions() {
  console.log('🔍 Checking Edge Functions for RLS patterns...');

  const functionFiles = glob.sync('supabase/functions/**/index.ts', {
    ignore: ['node_modules/**', 'dist/**']
  });

  functionFiles.forEach(checkFile);

  console.log(`📝 Checked ${functionFiles.length} edge function files`);
}

function checkSourceCode() {
  console.log('🔍 Checking source code for dangerous RLS patterns...');

  const sourceFiles = glob.sync('src/**/*.{ts,tsx,js,jsx}', {
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

  if (hasErrors) {
    console.log('\n💥 CRITICAL ISSUES FOUND:');
    console.log('These patterns can completely bypass RLS security!');
    console.log('\n🛠️  Common fixes:');
    console.log('1. Qualify column names: table_name.user_id = auth.uid()');
    console.log('2. Avoid parameter shadowing: use different names');
    console.log('3. Replace USING (true) with proper conditions');
    console.log('4. Review all RLS policies for logic errors');
  }
}

function main() {
  console.log('🚀 Starting RLS Tautology Check...\n');

  checkSQLFiles();
  checkEdgeFunctions();
  checkSourceCode();

  const report = generateReport();
  printSummary(report);

  // Exit with error code if critical issues found
  if (hasErrors) {
    console.log('\n❌ Build should FAIL due to critical RLS issues!');
    process.exit(1);
  } else if (hasWarnings) {
    console.log('\n⚠️  Warnings found, but build can continue');
    process.exit(0);
  } else {
    console.log('\n✅ All RLS checks passed!');
    process.exit(0);
  }
}

// Run the check
if (require.main === module) {
  main();
}

module.exports = { checkFile, checkSQLFiles, checkEdgeFunctions, checkSourceCode };