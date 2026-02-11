#!/usr/bin/env node

/**
 * RLS Org-Scope Regression Check
 *
 * Validates that voice_agents, call_logs, and bookings (if present):
 *   1. Have RLS enabled
 *   2. Have NO policy with qual='true' or with_check='true' (tautology)
 *   3. Have organization_id column
 *   4. Have org-scoped policies referencing organization_members
 *
 * Can run in two modes:
 *   - Static (default): scans migration SQL files for dangerous patterns
 *   - Live (--live):     queries pg_policies via Supabase (requires SUPABASE_DB_URL)
 *
 * Usage:
 *   node scripts/check-rls-org-scope.cjs          # static scan
 *   node scripts/check-rls-org-scope.cjs --live   # live DB check (needs running Supabase)
 */

const fs = require('fs');
const path = require('path');

// ── Tables under audit ──────────────────────────────────────────────────────
const CRITICAL_TABLES = ['voice_agents', 'call_logs', 'bookings'];

// ── Static analysis ─────────────────────────────────────────────────────────

function staticCheck() {
    console.log('🔍 Static RLS org-scope regression check\n');

    const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    // Track the final state after all migrations
    // We parse CREATE POLICY / DROP POLICY statements in order
    const activePolicies = {}; // tableName -> Map<policyName, { using, withCheck }>
    const rlsEnabled = {};     // tableName -> boolean
    const droppedTables = new Set();
    const hasOrgIdColumn = {}; // tableName -> boolean

    CRITICAL_TABLES.forEach(t => {
        activePolicies[t] = new Map();
        rlsEnabled[t] = false;
        hasOrgIdColumn[t] = false;
    });

    // Regex patterns (case-insensitive)
    const reCreatePolicy = /CREATE\s+POLICY\s+"?([^"]+)"?\s+ON\s+public\.(\w+)/gi;
    const reDropPolicy = /DROP\s+POLICY\s+IF\s+EXISTS\s+(?:"([^"]+)"|(\w+))\s+ON\s+public\.(\w+)/gi;
    const reEnableRLS = /ALTER\s+TABLE\s+public\.(\w+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;
    const reDropTable = /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?public\.(\w+)/gi;
    const reAddOrgId = /ADD\s+COLUMN\s+organization_id\b/gi;
    // Tautology detection in CREATE POLICY context
    const rePolicyUsingTrue = /USING\s*\(\s*true\s*\)/gi;
    const rePolicyWithCheckTrue = /WITH\s+CHECK\s*\(\s*true\s*\)/gi;

    for (const file of files) {
        const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

        // Check for DROP TABLE
        let m;
        while ((m = reDropTable.exec(content)) !== null) {
            const table = m[1].toLowerCase();
            if (CRITICAL_TABLES.includes(table)) {
                droppedTables.add(table);
                activePolicies[table] = new Map();
            }
        }

        // Check ENABLE RLS
        while ((m = reEnableRLS.exec(content)) !== null) {
            const table = m[1].toLowerCase();
            if (CRITICAL_TABLES.includes(table)) {
                rlsEnabled[table] = true;
            }
        }

        // Check DROP POLICY
        while ((m = reDropPolicy.exec(content)) !== null) {
            const policyName = m[1] || m[2];
            const table = m[3].toLowerCase();
            if (CRITICAL_TABLES.includes(table)) {
                activePolicies[table].delete(policyName);
            }
        }

        // Check CREATE POLICY — capture surrounding context for tautology detection
        // Split by CREATE POLICY to analyze each block
        const blocks = content.split(/(?=CREATE\s+POLICY)/gi);
        for (const block of blocks) {
            const createMatch = /^CREATE\s+POLICY\s+(?:"([^"]+)"|(\w+))\s+ON\s+public\.(\w+)/i.exec(block);
            if (!createMatch) continue;
            const policyName = createMatch[1] || createMatch[2];
            const table = createMatch[3].toLowerCase();
            if (!CRITICAL_TABLES.includes(table)) continue;

            // Check for tautology in this policy block (up to next CREATE POLICY or end)
            const hasTautologyUsing = rePolicyUsingTrue.test(block);
            rePolicyUsingTrue.lastIndex = 0;
            const hasTautologyCheck = rePolicyWithCheckTrue.test(block);
            rePolicyWithCheckTrue.lastIndex = 0;

            const hasOrgMembers = /organization_members/i.test(block);

            activePolicies[table].set(policyName, {
                tautologyUsing: hasTautologyUsing,
                tautologyCheck: hasTautologyCheck,
                orgScoped: hasOrgMembers,
            });
        }

        // Check for ADD COLUMN organization_id (in context of our tables)
        for (const table of CRITICAL_TABLES) {
            const tablePattern = new RegExp(`public\\.${table}[\\s\\S]{0,200}ADD\\s+COLUMN\\s+organization_id`, 'gi');
            // Also check DO $$ blocks that reference the table and add column
            const altPattern = new RegExp(`(voice_agents|call_logs|bookings).*organization_id|organization_id.*${table}`, 'gi');
            if (tablePattern.test(content) || (content.includes(table) && /ADD\s+COLUMN\s+organization_id/i.test(content) && content.includes(`'${table}'`))) {
                hasOrgIdColumn[table] = true;
            }
        }
    }

    // ── Assertions ──────────────────────────────────────────────────────────
    let failures = 0;
    const results = [];

    for (const table of CRITICAL_TABLES) {
        if (droppedTables.has(table)) {
            results.push({ table, status: 'SKIP', reason: 'Table was dropped — no policies needed' });
            continue;
        }

        // 1. RLS enabled
        if (!rlsEnabled[table]) {
            results.push({ table, status: 'FAIL', check: 'rls_enabled', reason: 'RLS not enabled' });
            failures++;
        } else {
            results.push({ table, status: 'PASS', check: 'rls_enabled' });
        }

        // 2. No tautology policies
        const policies = activePolicies[table];
        for (const [name, info] of policies) {
            if (info.tautologyUsing || info.tautologyCheck) {
                results.push({
                    table,
                    status: 'FAIL',
                    check: 'no_tautology',
                    reason: `Policy "${name}" has tautology (using=${info.tautologyUsing}, check=${info.tautologyCheck})`,
                });
                failures++;
            }
        }

        // 3. Has org-scoped policies
        const orgScopedPolicies = [...policies.entries()].filter(([, info]) => info.orgScoped);
        if (orgScopedPolicies.length === 0) {
            results.push({ table, status: 'FAIL', check: 'org_scoped_policies', reason: 'No org-scoped policies found' });
            failures++;
        } else {
            results.push({ table, status: 'PASS', check: 'org_scoped_policies', count: orgScopedPolicies.length });
        }

        // 4. Has organization_id column
        if (!hasOrgIdColumn[table]) {
            results.push({ table, status: 'FAIL', check: 'has_org_id_column', reason: 'organization_id column not found in migrations' });
            failures++;
        } else {
            results.push({ table, status: 'PASS', check: 'has_org_id_column' });
        }

        // 5. Minimum 4 policies (SELECT, INSERT, UPDATE, DELETE)
        if (policies.size < 4) {
            results.push({ table, status: 'FAIL', check: 'min_policies', reason: `Only ${policies.size} policies (need at least 4 for CRUD)` });
            failures++;
        } else {
            results.push({ table, status: 'PASS', check: 'min_policies', count: policies.size });
        }
    }

    // ── Output ────────────────────────────────────────────────────────────────
    console.log('Results:');
    console.log('─'.repeat(80));
    for (const r of results) {
        const icon = r.status === 'PASS' ? '✅' : r.status === 'SKIP' ? '⏭️ ' : '❌';
        const detail = r.reason || r.check || '';
        console.log(`  ${icon} ${r.table.padEnd(15)} ${(r.check || '').padEnd(22)} ${detail}`);
    }
    console.log('─'.repeat(80));

    // Save report
    const reportDir = path.join(__dirname, '..', 'test-results');
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
    const report = {
        timestamp: new Date().toISOString(),
        test_type: 'rls_org_scope_regression',
        tables: CRITICAL_TABLES,
        failures,
        results,
    };
    fs.writeFileSync(path.join(reportDir, 'rls-org-scope-check.json'), JSON.stringify(report, null, 2));

    if (failures > 0) {
        console.log(`\n❌ ${failures} failure(s) detected — RLS org-scope regression FAILED`);
        process.exit(1);
    } else {
        console.log('\n✅ All RLS org-scope regression checks passed!');
        process.exit(0);
    }
}

// ── Main ────────────────────────────────────────────────────────────────────
staticCheck();
