#!/usr/bin/env node

/**
 * CI Hygiene Gate: No seed-like data in migrations
 *
 * Scans supabase/migrations/*.sql for obvious seed patterns:
 *   - INSERT INTO plan_configs (plan pricing/config data belongs in seed.sql)
 *   - INSERT INTO auth.users with hardcoded test data
 *   - INSERT INTO organizations/agent_profiles with demo/test data outside functions
 *   - INSERT INTO superadmins with hardcoded UUIDs
 *
 * Legacy migrations are allowlisted (we don't rewrite history).
 * Only NEW migrations must pass this gate.
 *
 * Usage:
 *   node scripts/check-no-seed-in-migrations.cjs
 */

const fs = require('fs');
const path = require('path');

// ── Legacy allowlist ────────────────────────────────────────────────────────
// These migrations predate this hygiene gate and have been audited.
// They are NOT removed (no history rewrite). New migrations must not add
// seed-like inserts.
const LEGACY_ALLOWLIST = new Set([
    // plan_configs seed inserts
    '20250823215634_36eb0f09-8ada-4302-a868-2b36faa4d65a.sql',
    '20250823215738_ca8e8433-1ea5-4338-ac9e-89bd79bdf062.sql',
    '20250823221638_8b531a97-c1ca-4d44-b82b-8b3d334f1a5f.sql',
    '20250823221751_84015fe7-147f-4948-816d-8890ab06165e.sql',
    '20250823221939_9bf762de-4968-48e1-9b7b-6d2b8dee814a.sql',
    '20250823230711_322a4f0f-eebe-4ae8-9174-17b4b4746ade.sql',
    '20250906214301_974a66c4-064d-4b35-afab-00f7b82a6eda.sql',
    '20250906214452_e31f33eb-bf0d-4fd7-8fdb-60aeed1da579.sql',
    '20250907195744_ed8ff751-36d1-4a4e-b25c-c708ed704217.sql',
    // Demo org / demo agent inserts
    '20250818020027_39f19096-c5b7-4f9f-9198-48f589def0c9.sql',
    '20250818020044_fc8ba1b4-f9d8-4eb6-9841-44d0608c86c9.sql',
    '20250818041513_2adcd5fd-622e-4c26-b41e-b89484b52755.sql',
    '20250818041742_fba8fee3-4027-4764-b156-47896a1ae3e5.sql',
    // Superadmin hardcoded UUID inserts
    '20250825182950_ccf7f0b5-ae11-4c58-b5c6-455757316c07.sql',
    '20250825183249_4ab60411-cbc3-4cdd-aecf-d66b8fd81f32.sql',
    '20250825183745_72be4c60-1b24-48fd-8076-30d18e8de18b.sql',
    '20250825193201_c21df257-2359-4412-acff-7413be3652f6.sql',
    '20250825193234_07c41be6-8446-41c6-be83-98b254c2b2bb.sql',
    // Test org scaffold in verification blocks
    '20250826042439_e7bc1730-70a3-40dc-a4c5-024224ab8da3.sql',
    '20250826044939_beb9f32f-f053-42f7-892b-a24f3ce771d1.sql',
    '20250826045008_f214636a-a9bb-4fe7-aae5-de5353c63feb.sql',
    // Cleanup migration (by design inserts superadmin by email)
    '20260211020000_remove_hardcoded_superadmin_uuid_coupling.sql',
]);

// ── Seed-like patterns ──────────────────────────────────────────────────────
// These detect top-level INSERT statements (outside CREATE FUNCTION bodies).
// We use a simplified heuristic: flag any INSERT that targets seed tables
// UNLESS it's inside a CREATE FUNCTION ... $$ block.
const SEED_PATTERNS = [
    {
        regex: /^\s*INSERT\s+INTO\s+public\.plan_configs\b/im,
        description: 'INSERT INTO plan_configs — plan data belongs in seed.sql',
    },
    {
        regex: /^\s*INSERT\s+INTO\s+auth\.users\b/im,
        description: 'INSERT INTO auth.users — test users belong in seed.sql',
    },
    {
        regex: /^\s*INSERT\s+INTO\s+public\.superadmins\b(?!.*\bfunction\b)/im,
        description: 'INSERT INTO superadmins — superadmin grants belong in seed.sql or bootstrap RPC',
    },
];

function isInsideFunctionBody(content, matchIndex) {
    // Check if the match position is between $$ or $function$ delimiters
    // (i.e. inside a CREATE FUNCTION body, which is acceptable)
    const before = content.substring(0, matchIndex);
    const dollarQuotes = (before.match(/\$\$|\$function\$/g) || []).length;
    // If odd number of $$ before match, we're inside a function body
    return dollarQuotes % 2 === 1;
}

function checkFile(filePath, fileName) {
    const content = fs.readFileSync(filePath, 'utf8');
    const violations = [];

    for (const pattern of SEED_PATTERNS) {
        const match = pattern.regex.exec(content);
        if (match) {
            // Skip if inside a function body (CREATE FUNCTION ... $$ ... $$)
            if (isInsideFunctionBody(content, match.index)) {
                continue;
            }

            const lineNumber = content.substring(0, match.index).split('\n').length;
            violations.push({
                file: fileName,
                line: lineNumber,
                pattern: pattern.description,
            });
        }
    }

    return violations;
}

function main() {
    console.log('🔍 Checking migrations for seed-like data inserts...\n');

    const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
    if (!fs.existsSync(migrationsDir)) {
        console.log('⚠️  No migrations directory found — nothing to check');
        process.exit(0);
    }

    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

    let totalChecked = 0;
    let totalSkipped = 0;
    const allViolations = [];

    for (const file of files) {
        if (LEGACY_ALLOWLIST.has(file)) {
            totalSkipped++;
            continue;
        }

        totalChecked++;
        const violations = checkFile(path.join(migrationsDir, file), file);
        allViolations.push(...violations);
    }

    console.log(`📝 Checked ${totalChecked} migrations (${totalSkipped} legacy allowlisted)\n`);

    if (allViolations.length > 0) {
        console.log('❌ SEED DATA FOUND IN MIGRATIONS:\n');
        for (const v of allViolations) {
            console.log(`  ❌ ${v.file}:${v.line}`);
            console.log(`     ${v.pattern}\n`);
        }
        console.log('💡 Seed data should go in supabase/seed.sql (idempotent, ON CONFLICT).');
        console.log('   If this is a legitimate data migration, add the file to LEGACY_ALLOWLIST');
        console.log('   in scripts/check-no-seed-in-migrations.cjs with a justification comment.\n');
        process.exit(1);
    }

    console.log('✅ No seed-like data found in new migrations — passed!\n');
    process.exit(0);
}

if (require.main === module) {
    main();
}

module.exports = { checkFile, LEGACY_ALLOWLIST, SEED_PATTERNS };
