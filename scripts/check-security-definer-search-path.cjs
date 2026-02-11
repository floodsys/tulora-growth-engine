#!/usr/bin/env node

/**
 * SECURITY DEFINER search_path CI Check
 *
 * Ensures every SECURITY DEFINER function defined in Supabase migrations
 * includes an explicit SET search_path clause.  Functions without a safe
 * search_path can be exploited via schema-injection attacks.
 *
 * Modes:
 *   - Static (default): scans migration SQL files.
 *   - CI gate:  exits non-zero when a violation is found outside the allowlist.
 *
 * Usage:
 *   node scripts/check-security-definer-search-path.cjs
 */

const fs = require('fs');
const path = require('path');

// ── Legacy migrations that contain bare SECURITY DEFINER definitions ────────
// Each entry is justified: the function is redefined (or ALTER-ed) with a safe
// search_path in a later migration, so the old file is harmless at runtime.
const LEGACY_ALLOWLIST = new Set([
    // hash_ip(text) & trim_user_agent(text) — redefined with SET search_path
    // in 20250824010003 and 20250824010027.
    '20250824005843_334d0f67-e9f2-4487-badd-24bc505f7444.sql',

    // trigger_external_integrations() — hardened via ALTER FUNCTION in
    // 20260210081700_harden_security_definer_search_path.sql.
    '20250824012838_3a2e8a28-a019-4c83-b457-879d9358621a.sql',

    // check_org_member_access(uuid,uuid) — redefined with SET search_path
    // in 20250826052546.
    '20250824221621_f191251d-6e69-47a5-b051-d9b06e1fd083.sql',
]);

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract CREATE [OR REPLACE] FUNCTION blocks from SQL content and check
 * whether each SECURITY DEFINER block also contains SET search_path.
 *
 * Strategy: split the file into function-definition blocks and inspect each.
 */
function findViolations(filePath, content) {
    const violations = [];

    // Match CREATE [OR REPLACE] FUNCTION ... through the final $$ or $tag$ delimiter
    // We split on CREATE to isolate each function definition.
    const blocks = content.split(/(?=CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION)/gi);

    for (const block of blocks) {
        // Must start with CREATE … FUNCTION
        if (!/^CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION/i.test(block)) continue;

        // Must contain SECURITY DEFINER (not in a comment)
        if (!hasSecurityDefiner(block)) continue;

        // Must contain SET search_path
        if (/SET\s+search_path/i.test(block)) continue;

        // Extract function name for the report
        const nameMatch = block.match(
            /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([\w."]+)\s*\(/i
        );
        const funcName = nameMatch ? nameMatch[1] : '<unknown>';

        // Approximate line number in the original file
        const idx = content.indexOf(block);
        const lineNumber = content.substring(0, idx).split('\n').length;

        violations.push({ funcName, lineNumber, file: filePath });
    }

    // Also catch inline one-liners like:  $$ LANGUAGE plpgsql SECURITY DEFINER;
    // that aren't in a block we'd split on.
    const inlineRe = /\$\$\s*LANGUAGE\s+\w+\s+SECURITY\s+DEFINER\b(?!.*SET\s+search_path)/gi;
    let m;
    while ((m = inlineRe.exec(content)) !== null) {
        const lineNumber = content.substring(0, m.index).split('\n').length;
        // Make sure this wasn't already caught
        const alreadyCaught = violations.some(
            (v) => Math.abs(v.lineNumber - lineNumber) < 5
        );
        if (!alreadyCaught) {
            violations.push({
                funcName: '<inline>',
                lineNumber,
                file: filePath,
            });
        }
    }

    return violations;
}

/**
 * Returns true if the block contains a non-commented SECURITY DEFINER.
 */
function hasSecurityDefiner(block) {
    const lines = block.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('--')) continue; // skip line comments
        if (/SECURITY\s+DEFINER/i.test(trimmed)) return true;
    }
    return false;
}

// ── Main ────────────────────────────────────────────────────────────────────

function main() {
    console.log('🔒 SECURITY DEFINER search_path check\n');

    const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

    if (!fs.existsSync(migrationsDir)) {
        console.error('❌ Migrations directory not found:', migrationsDir);
        process.exit(1);
    }

    const files = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort();

    let totalChecked = 0;
    let totalSkipped = 0;
    let totalViolations = 0;
    const allViolations = [];

    for (const file of files) {
        const filePath = path.join(migrationsDir, file);
        const content = fs.readFileSync(filePath, 'utf8');

        // Quick pre-filter: skip files that don't mention SECURITY DEFINER at all
        if (!/SECURITY\s+DEFINER/i.test(content)) continue;

        totalChecked++;

        if (LEGACY_ALLOWLIST.has(file)) {
            totalSkipped++;
            console.log(`  ⏭️  Allowlisted (legacy): ${file}`);
            continue;
        }

        const violations = findViolations(filePath, content);

        if (violations.length > 0) {
            totalViolations += violations.length;
            allViolations.push(...violations);
            for (const v of violations) {
                console.error(
                    `  ❌ ${file}:${v.lineNumber}  ${v.funcName} — SECURITY DEFINER without SET search_path`
                );
            }
        }
    }

    // ── Report ──────────────────────────────────────────────────────────────
    const reportDir = path.join(__dirname, '..', 'test-results');
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

    const report = {
        timestamp: new Date().toISOString(),
        test_type: 'security_definer_search_path',
        files_with_definer: totalChecked,
        allowlisted: totalSkipped,
        violations: totalViolations,
        details: allViolations.map((v) => ({
            file: path.basename(v.file),
            line: v.lineNumber,
            function: v.funcName,
        })),
    };

    fs.writeFileSync(
        path.join(reportDir, 'security-definer-search-path.json'),
        JSON.stringify(report, null, 2)
    );

    console.log('\n' + '─'.repeat(70));
    console.log(
        `  Files scanned: ${files.length}  |  With DEFINER: ${totalChecked}  |  Allowlisted: ${totalSkipped}  |  Violations: ${totalViolations}`
    );
    console.log('─'.repeat(70));

    if (totalViolations > 0) {
        console.error(
            `\n❌ ${totalViolations} SECURITY DEFINER function(s) missing SET search_path — CI FAILED`
        );
        console.error(
            '   Fix: add  SET search_path = \'public\'  (or via ALTER FUNCTION in a new migration).'
        );
        process.exit(1);
    }

    console.log('\n✅ All SECURITY DEFINER functions have SET search_path — check passed!');
    process.exit(0);
}

if (require.main === module) {
    main();
}

module.exports = { findViolations, hasSecurityDefiner, LEGACY_ALLOWLIST };
