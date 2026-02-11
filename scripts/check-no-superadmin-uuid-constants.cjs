/**
 * Regression test: assert migrations do not contain environment-specific
 * superadmin UUID constants.
 *
 * Known hardcoded UUID: a2e9b538-5c1d-44be-a752-960a69e6f164
 *
 * Allowed exceptions:
 *   - 5 historical migrations (20250825–20250826) whose effect is overridden
 *     by the cleanup migration below. They cannot be edited post-deploy.
 *   - The cleanup migration itself (20260211020000_remove_hardcoded_superadmin_uuid_coupling.sql)
 *     which references the UUID only to DELETE / neutralise it.
 *   - Comments-only references (lines starting with --)
 *
 * Usage:
 *   node scripts/check-no-superadmin-uuid-constants.cjs
 *
 * Exit code 0 = pass, 1 = violations found
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ---- Configuration --------------------------------------------------------

const SUPERADMIN_UUIDS = [
    'a2e9b538-5c1d-44be-a752-960a69e6f164',
];

const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations');
const SEED_FILE = path.join(__dirname, '..', 'supabase', 'seed.sql');

// Migrations that are allowed to reference the UUID:
//   - Historical migrations (already applied, their effect is overridden by the cleanup migration)
//   - The cleanup migration itself (references UUID only to DELETE / neutralise it)
const ALLOWED_MIGRATION_PREFIXES = [
    '20250825183745', // historical: superadmin insert + verification (overridden)
    '20250825193201', // historical: superadmin insert + verification (overridden)
    '20250825193234', // historical: superadmin insert + verification (overridden)
    '20250826052044', // historical: activate seat for hardcoded UUID (overridden)
    '20250826052215', // historical: set org admin role for hardcoded UUID (overridden)
    '20260211020000', // cleanup: remove_hardcoded_superadmin_uuid_coupling
];

// ---- Scanner --------------------------------------------------------------

function scanMigrations() {
    if (!fs.existsSync(MIGRATIONS_DIR)) {
        console.error(`❌  Migrations directory not found: ${MIGRATIONS_DIR}`);
        process.exit(1);
    }

    const files = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort();

    const violations = [];

    for (const file of files) {
        // Skip allowed cleanup migrations
        if (ALLOWED_MIGRATION_PREFIXES.some(prefix => file.startsWith(prefix))) {
            continue;
        }

        const filePath = path.join(MIGRATIONS_DIR, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // Skip pure comment lines
            if (trimmed.startsWith('--')) continue;

            for (const uuid of SUPERADMIN_UUIDS) {
                if (line.toLowerCase().includes(uuid)) {
                    violations.push({
                        file,
                        line: i + 1,
                        content: trimmed.substring(0, 120),
                        uuid,
                    });
                }
            }
        }
    }

    return violations;
}

function scanSeedFile() {
    const violations = [];

    if (!fs.existsSync(SEED_FILE)) {
        // seed.sql is optional — not a failure
        return violations;
    }

    const content = fs.readFileSync(SEED_FILE, 'utf8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Skip pure comment lines
        if (trimmed.startsWith('--')) continue;

        for (const uuid of SUPERADMIN_UUIDS) {
            if (line.toLowerCase().includes(uuid)) {
                violations.push({
                    file: 'seed.sql',
                    line: i + 1,
                    content: trimmed.substring(0, 120),
                    uuid,
                });
            }
        }
    }

    return violations;
}

// ---- Main -----------------------------------------------------------------

console.log('🔍  Scanning migrations + seed.sql for hardcoded superadmin UUID constants...\n');

const migrationViolations = scanMigrations();
const seedViolations = scanSeedFile();
const violations = [...migrationViolations, ...seedViolations];

if (violations.length === 0) {
    console.log('✅  No hardcoded superadmin UUID constants found in active migration code or seed.sql.\n');
    console.log(`   Scanned: ${MIGRATIONS_DIR}`);
    console.log(`   Scanned: ${SEED_FILE}`);
    console.log(`   Blocked UUIDs: ${SUPERADMIN_UUIDS.join(', ')}`);
    console.log(`   Allowed exceptions: ${ALLOWED_MIGRATION_PREFIXES.join(', ')}`);
    process.exit(0);
} else {
    console.error(`❌  Found ${violations.length} violation(s):\n`);
    for (const v of violations) {
        console.error(`   ${v.file}:${v.line}`);
        console.error(`     UUID: ${v.uuid}`);
        console.error(`     Code: ${v.content}`);
        console.error('');
    }
    console.error('These files contain hardcoded superadmin UUIDs in executable SQL.');
    console.error('Superadmin grants should use email-based lookup or bootstrap_superadmin() RPC.');
    console.error('If this is a cleanup migration, add its timestamp prefix to ALLOWED_MIGRATION_PREFIXES.');
    process.exit(1);
}
