#!/usr/bin/env node

/**
 * CI Hygiene Gate: No risky DROP ... CASCADE in new migrations
 *
 * Flags new migrations that introduce:
 *   - DROP TABLE ... CASCADE
 *   - DROP FUNCTION ... CASCADE
 *
 * without an explicit guarded DO block and justification comment.
 *
 * Legacy migrations are allowlisted (we don't rewrite history).
 *
 * Usage:
 *   node scripts/check-no-risky-drop-cascade.cjs
 */

const fs = require('fs');
const path = require('path');

// ── Legacy allowlist ────────────────────────────────────────────────────────
// These migrations predate this hygiene gate and have been audited.
const LEGACY_ALLOWLIST = new Set([
    // DROP TABLE ... CASCADE (audited: table lifecycle operations)
    '20250823211238_fdd7b3a1-a28f-44f8-944e-d7380ad1fbca.sql',
    '20250823211335_c8e792f8-bdaf-4450-8970-8bc3bdb3fbd4.sql',
    '20250824005843_334d0f67-e9f2-4487-badd-24bc505f7444.sql',
    '20250824005917_08ae0a0d-7c62-4b06-82f5-32fc76b569d4.sql',
    '20250826232510_84d06a2f-78b8-41c7-99ad-736d0744c217.sql',
    '20250826232539_c3e72c23-675d-408d-92a2-47ccb8166b6f.sql',
    '20250826232836_dda30e47-cc33-4ffa-8990-7689ad9e8de7.sql',
    '20250826232919_04778bf2-0635-4e47-b8b3-24a0430fab64.sql',
    '20250828194049_c46a7801-9935-4d88-9492-de9b11696368.sql',
    '20250907233147_b04f18bf-2ee0-4658-88c2-c0493d1f8aff.sql',
]);

// ── Risky patterns ──────────────────────────────────────────────────────────
const RISKY_PATTERNS = [
    {
        regex: /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?[\w."]+\s+CASCADE/gi,
        description: 'DROP TABLE ... CASCADE — can silently destroy dependent objects',
    },
    {
        regex: /DROP\s+FUNCTION\s+(?:IF\s+EXISTS\s+)?[\w."(, )]+\s+CASCADE/gi,
        description: 'DROP FUNCTION ... CASCADE — can silently break dependent RLS policies',
    },
];

// Comments that indicate intentional, justified use
const JUSTIFICATION_MARKERS = [
    /-- JUSTIFICATION:/i,
    /-- CASCADE REASON:/i,
    /-- SAFE: guarded DO block/i,
];

function checkFile(filePath, fileName) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const violations = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip comment-only lines (the pattern might appear in a "Removed:" comment)
        if (/^\s*--/.test(line)) continue;

        for (const pattern of RISKY_PATTERNS) {
            pattern.regex.lastIndex = 0;
            if (pattern.regex.test(line)) {
                // Check preceding 3 lines for justification comment
                const contextStart = Math.max(0, i - 3);
                const context = lines.slice(contextStart, i + 1).join('\n');
                const hasJustification = JUSTIFICATION_MARKERS.some(m => m.test(context));

                if (!hasJustification) {
                    violations.push({
                        file: fileName,
                        line: i + 1,
                        code: line.trim(),
                        pattern: pattern.description,
                    });
                }
            }
        }
    }

    return violations;
}

function main() {
    console.log('🔍 Checking migrations for risky DROP ... CASCADE patterns...\n');

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
        console.log('❌ RISKY DROP CASCADE FOUND IN MIGRATIONS:\n');
        for (const v of allViolations) {
            console.log(`  ❌ ${v.file}:${v.line}`);
            console.log(`     ${v.pattern}`);
            console.log(`     Code: ${v.code}\n`);
        }
        console.log('💡 To fix:');
        console.log('   1. Use a guarded DO $$ block with IF EXISTS checks');
        console.log('   2. Add a justification comment above the DROP:');
        console.log('      -- JUSTIFICATION: <reason why CASCADE is safe here>');
        console.log('   3. Or add the file to LEGACY_ALLOWLIST with an audit note.\n');
        process.exit(1);
    }

    console.log('✅ No risky DROP CASCADE patterns found in new migrations — passed!\n');
    process.exit(0);
}

if (require.main === module) {
    main();
}

module.exports = { checkFile, LEGACY_ALLOWLIST, RISKY_PATTERNS };
