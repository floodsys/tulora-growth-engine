#!/usr/bin/env node

/**
 * Headless Invite System Test Runner for CI/CD
 * 
 * This script runs the invite system tests in a Node.js environment
 * without requiring a browser or UI. It uses the same test logic
 * but runs against Supabase directly.
 */

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const mode = args.find(arg => arg.startsWith('--mode='))?.split('=')[1] || 'smoke';

// Environment validation
function validateEnvironment() {
  const required = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    'VITE_TEST_ORG_ID'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`  - ${key}`));
    process.exit(1);
  }
  
  // Validate test level matches mode
  const testLevel = process.env.VITE_RUN_TEST_LEVEL;
  if (mode === 'full' && testLevel !== 'full') {
    console.error(`❌ Cannot run full tests with RUN_TEST_LEVEL=${testLevel}`);
    console.error('   Set VITE_RUN_TEST_LEVEL=full to run full test suite');
    process.exit(1);
  }
  
  console.log('✅ Environment validation passed');
  console.log(`📋 Running ${mode} tests against org: ${process.env.VITE_TEST_ORG_ID}`);
  console.log(`🔧 Test level: ${testLevel}`);
  console.log(`📧 Email delivery disabled: ${process.env.VITE_DISABLE_EMAIL_DELIVERY_FOR_TESTS}`);
}

// Initialize Supabase client
function createSupabaseClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  return createClient(supabaseUrl, supabaseKey);
}

// Test utility functions (adapted from invite-tests.ts)
class InviteTestRunner {
  constructor(supabase, testOrgId) {
    this.supabase = supabase;
    this.testOrgId = testOrgId;
  }

  async runReadOnlyTests() {
    const results = [];
    
    // Test 1: Test Environment Configuration
    try {
      const testOrgId = process.env.VITE_TEST_ORG_ID;
      const emailDisabled = process.env.VITE_DISABLE_EMAIL_DELIVERY_FOR_TESTS === 'true';
      
      results.push({
        testName: 'Test Environment Configuration',
        passed: !!testOrgId && emailDisabled,
        message: testOrgId && emailDisabled 
          ? 'Test environment properly configured with isolation'
          : 'Test environment not properly configured',
        details: { 
          testOrgId,
          emailDeliveryDisabled: emailDisabled,
          testLevel: process.env.VITE_RUN_TEST_LEVEL
        }
      });
    } catch (error) {
      results.push({
        testName: 'Test Environment Configuration',
        passed: false,
        message: `Error checking test configuration: ${error}`,
        details: error
      });
    }

    // Test 2: Can read organization data
    try {
      const { data, error } = await this.supabase
        .from('organizations')
        .select('*')
        .eq('id', this.testOrgId);

      results.push({
        testName: 'Can read organization data',
        passed: !error,
        message: error ? `Failed to read organization: ${error.message}` : 'Successfully read organization data',
        details: { error, found: !!data?.length }
      });
    } catch (error) {
      results.push({
        testName: 'Can read organization data',
        passed: false,
        message: `Error: ${error}`,
        details: error
      });
    }

    // Test 3: Can read organization members
    try {
      const { data, error } = await this.supabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', this.testOrgId);

      results.push({
        testName: 'Can read organization members',
        passed: !error,
        message: error ? `Failed to read members: ${error.message}` : `Successfully read ${data?.length || 0} members`,
        details: { error, dataCount: data?.length }
      });
    } catch (error) {
      results.push({
        testName: 'Can read organization members',
        passed: false,
        message: `Error: ${error}`,
        details: error
      });
    }

    // Test 4: Can read invitations (read-only)
    try {
      const { data, error } = await this.supabase
        .from('organization_invitations')
        .select('*')
        .eq('organization_id', this.testOrgId);

      results.push({
        testName: 'Can read invitations',
        passed: !error,
        message: error ? `Failed to read invitations: ${error.message}` : `Successfully read ${data?.length || 0} invitations`,
        details: { error, dataCount: data?.length }
      });
    } catch (error) {
      results.push({
        testName: 'Can read invitations',
        passed: false,
        message: `Error: ${error}`,
        details: error
      });
    }

    const passed = results.every(r => r.passed);
    return {
      suiteName: 'Read-Only Access (Smoke Test)',
      results,
      passed,
      summary: `${results.filter(r => r.passed).length}/${results.length} tests passed`
    };
  }

  async runFullTests() {
    // For now, only implement read-only tests in CI
    // Full tests would require implementing invite creation and acceptance
    // which is complex in a headless environment
    
    console.log('⚠️  Full test suite not yet implemented for headless CI environment');
    console.log('📝 This would require implementing:');
    console.log('   - Admin permission tests');
    console.log('   - Member permission tests');
    console.log('   - Invite flow tests');
    console.log('   - Data integrity tests');
    
    // For now, run read-only tests as a fallback
    const readOnlyResults = await this.runReadOnlyTests();
    
    return [
      readOnlyResults,
      {
        suiteName: 'Full Test Suite (Placeholder)',
        results: [{
          testName: 'Full test implementation',
          passed: false,
          message: 'Full test suite not yet implemented for CI environment',
          details: { reason: 'Requires headless implementation of write operations' }
        }],
        passed: false,
        summary: 'Implementation pending'
      }
    ];
  }
}

// Main test execution
async function runTests() {
  console.log('🚀 Starting invite system tests...');
  
  validateEnvironment();
  
  const supabase = createSupabaseClient();
  const testOrgId = process.env.VITE_TEST_ORG_ID;
  const runner = new InviteTestRunner(supabase, testOrgId);
  
  let results;
  
  try {
    if (mode === 'smoke') {
      console.log('🔍 Running smoke tests (read-only)...');
      const smokeResults = await runner.runReadOnlyTests();
      results = [smokeResults];
    } else if (mode === 'full') {
      console.log('🧪 Running full test suite...');
      results = await runner.runFullTests();
    } else {
      throw new Error(`Unknown test mode: ${mode}`);
    }
    
    // Output results
    console.log('\n📊 Test Results:');
    console.log('================');
    
    let allPassed = true;
    
    results.forEach((suite, index) => {
      const status = suite.passed ? '✅' : '❌';
      console.log(`\n${status} ${suite.suiteName}`);
      console.log(`   ${suite.summary}`);
      
      suite.results.forEach(test => {
        const testStatus = test.passed ? '✅' : '❌';
        console.log(`   ${testStatus} ${test.testName}: ${test.message}`);
      });
      
      if (!suite.passed) {
        allPassed = false;
      }
    });
    
    // Save results to file for CI artifacts
    const resultsDir = join(__dirname, '..', 'test-results');
    mkdirSync(resultsDir, { recursive: true });
    
    const resultsFile = join(resultsDir, 'invite-tests.json');
    writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    
    console.log(`\n💾 Results saved to: ${resultsFile}`);
    
    // Exit with appropriate code
    if (allPassed) {
      console.log('\n🎉 All tests passed!');
      process.exit(0);
    } else {
      console.log('\n💥 Some tests failed!');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n💥 Test execution failed:');
    console.error(error);
    
    // Save error to results file
    const errorResults = [{
      suiteName: 'Test Execution Error',
      results: [{
        testName: 'Test Runner',
        passed: false,
        message: `Test execution failed: ${error.message}`,
        details: error
      }],
      passed: false,
      summary: 'Execution failed'
    }];
    
    const resultsDir = join(__dirname, '..', 'test-results');
    mkdirSync(resultsDir, { recursive: true });
    
    const resultsFile = join(resultsDir, 'invite-tests.json');
    writeFileSync(resultsFile, JSON.stringify(errorResults, null, 2));
    
    process.exit(1);
  }
}

// Run the tests
runTests();