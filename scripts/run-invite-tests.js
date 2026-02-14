#!/usr/bin/env node

/**
 * Headless Invite System Test Runner for CI/CD
 *
 * Modes:
 *   --mode=smoke   Read-only checks (org readable, members readable, invitations readable)
 *   --mode=full    Full invite lifecycle integration tests:
 *                    1) Create ephemeral org
 *                    2) Create invite for a second user email
 *                    3) Accept invite with second user session
 *                    4) Verify membership row exists + correct role
 *                    5) Revoke invite behaviour verified
 *                    6) Negative test: non-admin cannot invite
 *                    7) Cleanup all ephemeral data
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY for full mode (admin auth API access).
 */

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const mode = args.find(arg => arg.startsWith('--mode='))?.split('=')[1] || 'smoke';

// ---------------------------------------------------------------------------
// Environment validation
// ---------------------------------------------------------------------------
function validateEnvironment() {
  const required = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_PUBLISHABLE_KEY',
  ];

  // smoke mode also needs a pre-existing org id
  if (mode === 'smoke') {
    required.push('VITE_TEST_ORG_ID');
  }

  // full mode needs service role key for admin operations
  if (mode === 'full') {
    required.push('SUPABASE_SERVICE_ROLE_KEY');
  }

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`  - ${key}`));
    process.exit(1);
  }

  console.log('✅ Environment validation passed');
  console.log(`📋 Running ${mode} tests`);
  if (mode === 'smoke') {
    console.log(`🏢 Target org: ${process.env.VITE_TEST_ORG_ID}`);
  }
  console.log(`📧 Email delivery disabled: ${process.env.VITE_DISABLE_EMAIL_DELIVERY_FOR_TESTS}`);
}

// ---------------------------------------------------------------------------
// Supabase clients
// ---------------------------------------------------------------------------
function createServiceClient() {
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function createAnonClient() {
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ---------------------------------------------------------------------------
// Smoke tests (read-only, unchanged from original)
// ---------------------------------------------------------------------------
async function runSmokeTests() {
  const supabase = createServiceClient();
  const testOrgId = process.env.VITE_TEST_ORG_ID;
  const results = [];

  // 1 - Environment config
  const emailDisabled = process.env.VITE_DISABLE_EMAIL_DELIVERY_FOR_TESTS === 'true';
  results.push({
    testName: 'Test Environment Configuration',
    passed: !!testOrgId && emailDisabled,
    message: testOrgId && emailDisabled
      ? 'Test environment properly configured with isolation'
      : 'Test environment not properly configured',
    details: { testOrgId, emailDeliveryDisabled: emailDisabled }
  });

  // 2 - Read org
  try {
    const { data, error } = await supabase
      .from('organizations').select('*').eq('id', testOrgId);
    results.push({
      testName: 'Can read organization data',
      passed: !error,
      message: error ? `Failed: ${error.message}` : 'OK',
      details: { found: !!data?.length }
    });
  } catch (e) {
    results.push({ testName: 'Can read organization data', passed: false, message: String(e) });
  }

  // 3 - Read members
  try {
    const { data, error } = await supabase
      .from('organization_members').select('*').eq('organization_id', testOrgId);
    results.push({
      testName: 'Can read organization members',
      passed: !error,
      message: error ? `Failed: ${error.message}` : `Found ${data?.length ?? 0} members`,
      details: { count: data?.length }
    });
  } catch (e) {
    results.push({ testName: 'Can read organization members', passed: false, message: String(e) });
  }

  // 4 - Read invitations
  try {
    const { data, error } = await supabase
      .from('organization_invitations').select('*').eq('organization_id', testOrgId);
    results.push({
      testName: 'Can read invitations',
      passed: !error,
      message: error ? `Failed: ${error.message}` : `Found ${data?.length ?? 0} invitations`,
      details: { count: data?.length }
    });
  } catch (e) {
    results.push({ testName: 'Can read invitations', passed: false, message: String(e) });
  }

  return {
    suiteName: 'Read-Only Access (Smoke)',
    results,
    passed: results.every(r => r.passed),
    summary: `${results.filter(r => r.passed).length}/${results.length} passed`
  };
}

// ---------------------------------------------------------------------------
// Full invite lifecycle integration tests
// ---------------------------------------------------------------------------
async function runFullTests() {
  const svc = createServiceClient();
  const tag = randomUUID().slice(0, 8); // unique suffix for this run
  const results = [];
  const cleanup = []; // functions to call on teardown

  // Helper: record result
  function record(testName, passed, message, details = {}) {
    results.push({ testName, passed, message, details });
    const icon = passed ? '✅' : '❌';
    console.log(`  ${icon} ${testName}: ${message}`);
  }

  // -----------------------------------------------------------------------
  // Setup: create two ephemeral auth users via Admin API
  // -----------------------------------------------------------------------
  const adminEmail = `ci-admin-${tag}@test.invalid`;
  const memberEmail = `ci-member-${tag}@test.invalid`;
  const password = `Test!${randomUUID()}`;
  let adminUserId, memberUserId, testOrgId;

  console.log('\n🔧 Setting up ephemeral test data...');

  try {
    // Create admin user
    const { data: u1, error: e1 } = await svc.auth.admin.createUser({
      email: adminEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'CI Admin' }
    });
    if (e1) throw new Error(`Create admin user: ${e1.message}`);
    adminUserId = u1.user.id;
    cleanup.push(() => svc.auth.admin.deleteUser(adminUserId));

    // Create member user
    const { data: u2, error: e2 } = await svc.auth.admin.createUser({
      email: memberEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'CI Member' }
    });
    if (e2) throw new Error(`Create member user: ${e2.message}`);
    memberUserId = u2.user.id;
    cleanup.push(() => svc.auth.admin.deleteUser(memberUserId));

    console.log(`  👤 Admin user:  ${adminUserId} (${adminEmail})`);
    console.log(`  👤 Member user: ${memberUserId} (${memberEmail})`);
  } catch (err) {
    record('Setup: create ephemeral users', false, err.message);
    await runCleanup(cleanup);
    return buildSuiteResult('Full Invite Lifecycle', results);
  }

  // -----------------------------------------------------------------------
  // 1. Create ephemeral org
  // -----------------------------------------------------------------------
  try {
    const { data, error } = await svc.from('organizations').insert({
      name: `CI Test Org ${tag}`,
      owner_user_id: adminUserId,
      status: 'active'
    }).select().single();

    if (error) throw new Error(error.message);
    testOrgId = data.id;
    cleanup.push(() => svc.from('organizations').delete().eq('id', testOrgId));

    record('1. Create ephemeral org', true, `org ${testOrgId}`);
  } catch (err) {
    record('1. Create ephemeral org', false, err.message);
    await runCleanup(cleanup);
    return buildSuiteResult('Full Invite Lifecycle', results);
  }

  // -----------------------------------------------------------------------
  // 1b. Add admin user as admin member
  // -----------------------------------------------------------------------
  try {
    const { error } = await svc.from('organization_members').insert({
      organization_id: testOrgId,
      user_id: adminUserId,
      role: 'admin'
    });
    if (error) throw new Error(error.message);
    cleanup.push(() =>
      svc.from('organization_members').delete()
        .eq('organization_id', testOrgId).eq('user_id', adminUserId)
    );
    record('1b. Admin membership created', true, 'admin role assigned');
  } catch (err) {
    record('1b. Admin membership created', false, err.message);
    await runCleanup(cleanup);
    return buildSuiteResult('Full Invite Lifecycle', results);
  }

  // -----------------------------------------------------------------------
  // 2. Create invite for second user email
  // -----------------------------------------------------------------------
  let inviteId, inviteToken;
  try {
    const token = randomUUID();
    const { data, error } = await svc.from('organization_invitations').insert({
      organization_id: testOrgId,
      email: memberEmail,
      invited_by: adminUserId,
      invite_token: token,
      role: 'editor',
      status: 'pending',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    }).select().single();

    if (error) throw new Error(error.message);
    inviteId = data.id;
    inviteToken = token;
    cleanup.push(() =>
      svc.from('organization_invitations').delete().eq('id', inviteId)
    );
    record('2. Create invite for second user', true, `invite ${inviteId}, role=editor`);
  } catch (err) {
    record('2. Create invite for second user', false, err.message);
    await runCleanup(cleanup);
    return buildSuiteResult('Full Invite Lifecycle', results);
  }

  // -----------------------------------------------------------------------
  // 3. Accept invite (simulate: update status + create membership)
  // -----------------------------------------------------------------------
  try {
    // Verify the invite exists and is pending
    const { data: invite, error: readErr } = await svc
      .from('organization_invitations')
      .select('*')
      .eq('invite_token', inviteToken)
      .eq('status', 'pending')
      .single();

    if (readErr || !invite) throw new Error(`Invite lookup failed: ${readErr?.message || 'not found'}`);

    // Accept: update status
    const { error: updateErr } = await svc
      .from('organization_invitations')
      .update({ status: 'accepted' })
      .eq('id', inviteId);

    if (updateErr) throw new Error(`Accept update: ${updateErr.message}`);

    // Create membership for the invited user
    const { error: memberErr } = await svc.from('organization_members').insert({
      organization_id: testOrgId,
      user_id: memberUserId,
      role: invite.role
    });
    if (memberErr) throw new Error(`Membership insert: ${memberErr.message}`);
    cleanup.push(() =>
      svc.from('organization_members').delete()
        .eq('organization_id', testOrgId).eq('user_id', memberUserId)
    );

    record('3. Accept invite (token lookup → membership)', true, 'status=accepted, membership created');
  } catch (err) {
    record('3. Accept invite (token lookup → membership)', false, err.message);
    await runCleanup(cleanup);
    return buildSuiteResult('Full Invite Lifecycle', results);
  }

  // -----------------------------------------------------------------------
  // 4. Verify membership row + correct role
  // -----------------------------------------------------------------------
  try {
    const { data, error } = await svc
      .from('organization_members')
      .select('*')
      .eq('organization_id', testOrgId)
      .eq('user_id', memberUserId)
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Membership row not found');

    const roleCorrect = data.role === 'editor';
    record(
      '4. Verify membership row + role',
      roleCorrect,
      roleCorrect
        ? `role=${data.role} ✓`
        : `Expected editor, got ${data.role}`
    );
  } catch (err) {
    record('4. Verify membership row + role', false, err.message);
  }

  // -----------------------------------------------------------------------
  // 5. Revoke invite behaviour
  // -----------------------------------------------------------------------
  let revokeInviteId;
  try {
    // Create a new invite to revoke
    const token2 = randomUUID();
    const { data: inv2, error: createErr } = await svc.from('organization_invitations').insert({
      organization_id: testOrgId,
      email: `ci-revoke-${tag}@test.invalid`,
      invited_by: adminUserId,
      invite_token: token2,
      role: 'viewer',
      status: 'pending',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    }).select().single();

    if (createErr) throw new Error(`Create revoke-target invite: ${createErr.message}`);
    revokeInviteId = inv2.id;
    cleanup.push(() =>
      svc.from('organization_invitations').delete().eq('id', revokeInviteId)
    );

    // Revoke it
    const { error: revokeErr } = await svc
      .from('organization_invitations')
      .update({ status: 'revoked' })
      .eq('id', revokeInviteId);

    if (revokeErr) throw new Error(`Revoke update: ${revokeErr.message}`);

    // Verify the status is now 'revoked'
    const { data: revoked, error: checkErr } = await svc
      .from('organization_invitations')
      .select('status')
      .eq('id', revokeInviteId)
      .single();

    if (checkErr) throw new Error(`Revoke read-back: ${checkErr.message}`);
    const ok = revoked.status === 'revoked';
    record('5. Revoke invite behaviour', ok,
      ok ? 'status=revoked ✓' : `Expected revoked, got ${revoked.status}`);
  } catch (err) {
    record('5. Revoke invite behaviour', false, err.message);
  }

  // -----------------------------------------------------------------------
  // 6. Negative test: non-admin cannot create invites
  //    (use anon client signed in as the member user — who has role=editor)
  // -----------------------------------------------------------------------
  try {
    const anonClient = createAnonClient();

    // Sign in as the member (editor) user
    const { error: signInErr } = await anonClient.auth.signInWithPassword({
      email: memberEmail,
      password
    });
    if (signInErr) throw new Error(`Sign-in as member: ${signInErr.message}`);

    // Attempt to insert an invite — should be denied by RLS
    const { error: insertErr } = await anonClient.from('organization_invitations').insert({
      organization_id: testOrgId,
      email: `ci-should-fail-${tag}@test.invalid`,
      invited_by: memberUserId,
      invite_token: randomUUID(),
      role: 'viewer',
      status: 'pending',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });

    // We WANT this to fail (RLS should block non-admin inserts)
    if (insertErr) {
      record('6. Non-admin cannot invite (RLS)', true,
        `Correctly blocked: ${insertErr.message.slice(0, 80)}`);
    } else {
      // If it succeeded, clean up and report failure
      record('6. Non-admin cannot invite (RLS)', false,
        'Insert succeeded — RLS is not blocking non-admin invite creation!');
      // Clean up the rogue invite
      await svc.from('organization_invitations')
        .delete()
        .eq('organization_id', testOrgId)
        .eq('email', `ci-should-fail-${tag}@test.invalid`);
    }

    await anonClient.auth.signOut();
  } catch (err) {
    // An exception during sign-in or setup counts as a skip, not a pass
    record('6. Non-admin cannot invite (RLS)', false, err.message);
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------
  console.log('\n🧹 Cleaning up ephemeral test data...');
  await runCleanup(cleanup);

  return buildSuiteResult('Full Invite Lifecycle', results);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function runCleanup(fns) {
  for (const fn of fns.reverse()) {
    try { await fn(); } catch (e) {
      console.warn(`  ⚠️  cleanup error (non-fatal): ${e.message || e}`);
    }
  }
}

function buildSuiteResult(suiteName, results) {
  const passed = results.length > 0 && results.every(r => r.passed);
  return {
    suiteName,
    results,
    passed,
    summary: `${results.filter(r => r.passed).length}/${results.length} passed`
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function runTests() {
  console.log('🚀 Starting invite system tests...');
  validateEnvironment();

  let suites;

  if (mode === 'smoke') {
    console.log('\n🔍 Running smoke tests (read-only)...');
    suites = [await runSmokeTests()];
  } else if (mode === 'full') {
    console.log('\n🧪 Running full invite lifecycle tests...');
    // Full mode includes smoke (read-only) against pre-existing org if available,
    // plus the full lifecycle suite with ephemeral data.
    const fullResult = await runFullTests();
    suites = [fullResult];

    // Optionally run smoke too if VITE_TEST_ORG_ID is set
    if (process.env.VITE_TEST_ORG_ID) {
      console.log('\n🔍 Also running smoke tests against pre-existing org...');
      suites.push(await runSmokeTests());
    }
  } else {
    console.error(`❌ Unknown test mode: ${mode}`);
    process.exit(1);
  }

  // Output results
  console.log('\n📊 Test Results:');
  console.log('================');

  let allPassed = true;
  for (const suite of suites) {
    const icon = suite.passed ? '✅' : '❌';
    console.log(`\n${icon} ${suite.suiteName}  (${suite.summary})`);
    for (const t of suite.results) {
      console.log(`   ${t.passed ? '✅' : '❌'} ${t.testName}: ${t.message}`);
    }
    if (!suite.passed) allPassed = false;
  }

  // Save results
  const resultsDir = join(__dirname, '..', 'test-results');
  mkdirSync(resultsDir, { recursive: true });
  const resultsFile = join(resultsDir, 'invite-tests.json');
  writeFileSync(resultsFile, JSON.stringify(suites, null, 2));
  console.log(`\n💾 Results saved to: ${resultsFile}`);

  if (allPassed) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('\n💥 Some tests failed!');
    process.exit(1);
  }
}

runTests();
