#!/usr/bin/env node

/**
 * RLS Smoke Tests - Function Validation
 * 
 * Tests core RLS functions with random UUIDs to ensure they return false
 * when they should (preventing tautology bugs).
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test configuration
const RLS_FUNCTIONS = [
  {
    name: 'check_admin_access',
    description: 'Should return false for non-admin users',
    params: ['org_id']
  },
  {
    name: 'check_org_membership', 
    description: 'Should return false for non-members',
    params: ['org_id', 'user_id']
  },
  {
    name: 'check_org_ownership',
    description: 'Should return false for non-owners',
    params: ['org_id', 'user_id']
  },
  {
    name: 'is_org_admin',
    description: 'Should return false for non-admin users',
    params: ['org_id']
  },
  {
    name: 'is_org_member',
    description: 'Should return false for non-members',
    params: ['org_id']
  },
  {
    name: 'is_superadmin',
    description: 'Should return false for non-superadmin users',
    params: ['user_id']
  }
];

class RLSSmokeTestRunner {
  constructor() {
    this.supabase = this.createSupabaseClient();
    this.results = [];
  }

  createSupabaseClient() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://nkjxbeypbiclvouqfjyc.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    if (!supabaseKey) {
      throw new Error('Missing Supabase key. Set SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_PUBLISHABLE_KEY');
    }
    
    return createClient(supabaseUrl, supabaseKey);
  }

  generateRandomParams(paramNames) {
    const params = {};
    paramNames.forEach(param => {
      if (param.includes('id')) {
        params[param] = randomUUID();
      } else {
        params[param] = randomUUID(); // Default to UUID for now
      }
    });
    return params;
  }

  async testFunction(func) {
    const startTime = Date.now();
    let success = false;
    let result = null;
    let error = null;
    
    try {
      const params = this.generateRandomParams(func.params);
      console.log(`🧪 Testing ${func.name} with random params:`, params);
      
      // Call the RPC function
      const { data, error: rpcError } = await this.supabase.rpc(func.name, params);
      
      if (rpcError) {
        error = rpcError;
        console.log(`   ❌ RPC Error: ${rpcError.message}`);
      } else {
        result = data;
        // For these functions, we expect false with random UUIDs
        success = (data === false);
        
        if (success) {
          console.log(`   ✅ Correctly returned false`);
        } else {
          console.log(`   ❌ Unexpected result: ${data} (expected false)`);
        }
      }
    } catch (err) {
      error = err;
      console.log(`   ❌ Exception: ${err.message}`);
    }
    
    const duration = Date.now() - startTime;
    
    const testResult = {
      function: func.name,
      description: func.description,
      params: this.generateRandomParams(func.params),
      result,
      expected: false,
      success,
      error: error ? error.message : null,
      duration_ms: duration,
      timestamp: new Date().toISOString()
    };
    
    this.results.push(testResult);
    return testResult;
  }

  async runAllTests() {
    console.log('🚀 Starting RLS Smoke Tests...\n');
    console.log('🎯 Testing that RLS functions return false for random UUIDs');
    console.log('   (This prevents tautology bugs like user_id = user_id)\n');
    
    for (const func of RLS_FUNCTIONS) {
      await this.testFunction(func);
      console.log(''); // Empty line between tests
    }
    
    return this.results;
  }

  generateReport() {
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.length - passed;
    
    const report = {
      timestamp: new Date().toISOString(),
      test_type: 'rls_smoke_tests',
      summary: {
        total_tests: this.results.length,
        passed,
        failed,
        success_rate: (passed / this.results.length * 100).toFixed(1) + '%'
      },
      purpose: 'Validate RLS functions return false for random UUIDs (prevent tautologies)',
      functions_tested: RLS_FUNCTIONS.map(f => ({
        name: f.name,
        description: f.description,
        params: f.params
      })),
      results: this.results
    };
    
    // Save report
    const reportDir = join(__dirname, '..', 'test-results');
    mkdirSync(reportDir, { recursive: true });
    
    const reportPath = join(reportDir, 'rls-smoke-tests.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📊 Report saved to: ${reportPath}`);
    return report;
  }

  printSummary(report) {
    console.log('\n📊 RLS Smoke Test Summary:');
    console.log('==========================');
    console.log(`Total tests: ${report.summary.total_tests}`);
    console.log(`Passed: ${report.summary.passed}`);
    console.log(`Failed: ${report.summary.failed}`);
    console.log(`Success rate: ${report.summary.success_rate}`);
    
    if (report.summary.failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.results
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`   ${r.function}: ${r.error || `returned ${r.result}, expected false`}`);
        });
      
      console.log('\n💥 CRITICAL: RLS functions are not working correctly!');
      console.log('This indicates potential tautology bugs that bypass security.');
      console.log('\n🛠️  Investigation needed:');
      console.log('1. Check function definitions for parameter shadowing');
      console.log('2. Verify table.column qualification in WHERE clauses');
      console.log('3. Look for user_id = user_id patterns');
      console.log('4. Test with known good/bad values manually');
    } else {
      console.log('\n✅ All RLS functions working correctly!');
      console.log('Functions properly return false for unauthorized access.');
    }
  }
}

async function main() {
  try {
    const runner = new RLSSmokeTestRunner();
    await runner.runAllTests();
    
    const report = runner.generateReport();
    runner.printSummary(report);
    
    // Exit with error if any tests failed
    if (report.summary.failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('\n💥 RLS Smoke Tests failed to run:');
    console.error(error.message);
    console.error('\nCheck environment variables and Supabase connection.');
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { RLSSmokeTestRunner };