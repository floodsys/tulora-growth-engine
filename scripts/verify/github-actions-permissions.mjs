#!/usr/bin/env node
/**
 * scripts/verify/github-actions-permissions.mjs
 *
 * Cross-platform (Node) replacement for github-actions-permissions.sh.
 *
 * Verifies:
 *   1. All .github/workflows/*.yml files have explicit `permissions:` blocks
 *   2. GitHub Actions default_workflow_permissions are read-only (via gh CLI API, best-effort)
 *
 * Requires: gh CLI authenticated (GITHUB_TOKEN or `gh auth login`) for the API check.
 *
 * Overall result logic:
 *   - If workflow files scan is PASS (all workflows have explicit `permissions:`),
 *     overall is PASS even if the API check is UNKNOWN or SKIP.
 *   - If either check is FAIL, overall is FAIL.
 *   - If workflow files scan is not PASS, UNKNOWN/SKIP propagate normally.
 *
 * Exit codes:
 *   0 = PASS
 *   1 = FAIL
 *   2 = SKIP
 *   3 = UNKNOWN
 */

import { execSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const WORKFLOW_DIR = join(ROOT, ".github", "workflows");

// ─── helpers ────────────────────────────────────────────────────────────────

/** Run a command and return stdout, or null on failure. */
function run(cmd) {
    try {
        return execSync(cmd, { encoding: "utf8", timeout: 15_000, stdio: ["pipe", "pipe", "pipe"] }).trim();
    } catch {
        return null;
    }
}

/** Check if `gh` CLI exists on PATH. */
function ghExists() {
    return run("gh --version") !== null;
}

/** Check if `gh` is authenticated. */
function ghAuthenticated() {
    return run("gh auth status") !== null;
}

/** Detect the owner/repo from gh or git remote. */
function detectRepo() {
    // Try gh first
    const ghRepo = run('gh repo view --json nameWithOwner -q .nameWithOwner');
    if (ghRepo) return ghRepo;

    // Fallback: parse git remote
    const remoteUrl = run("git remote get-url origin");
    if (remoteUrl) {
        const m = remoteUrl.match(/github\.com[:/](.+?)(?:\.git)?$/);
        if (m) return m[1];
    }
    return null;
}

/**
 * Check if a YAML line is a real `permissions:` directive (not a comment).
 * Matches top-level or job-level `permissions:` in a workflow file.
 */
function hasExplicitPermissions(content) {
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
        // Must not start with # (comment) after optional whitespace
        const trimmed = line.trimStart();
        if (trimmed.startsWith("#")) continue;
        // Match `permissions:` at any indentation level (top-level or job-level)
        if (/^(\s*)permissions\s*:/.test(line)) {
            return true;
        }
    }
    return false;
}

// ─── check 1: workflow files have explicit permissions blocks ────────────────

function checkWorkflowPermissions() {
    console.log("  ── Workflow Permissions Blocks ──");

    if (!existsSync(WORKFLOW_DIR)) {
        console.log("    ⚠ No .github/workflows directory found.");
        return "UNKNOWN";
    }

    const files = readdirSync(WORKFLOW_DIR).filter(
        (f) => f.endsWith(".yml") || f.endsWith(".yaml")
    );

    if (files.length === 0) {
        console.log("    ⚠ No workflow files found.");
        return "UNKNOWN";
    }

    let withPerms = 0;
    let withoutPerms = 0;

    for (const file of files) {
        const content = readFileSync(join(WORKFLOW_DIR, file), "utf8");
        if (hasExplicitPermissions(content)) {
            console.log(`    ✓ ${file} — has explicit permissions block`);
            withPerms++;
        } else {
            console.log(`    ✗ ${file} — NO explicit permissions block`);
            withoutPerms++;
        }
    }

    console.log("");
    console.log(`    Total: ${files.length}  With permissions: ${withPerms}  Without: ${withoutPerms}`);

    if (withoutPerms === 0) {
        console.log("    ✓ PASS — all workflows have explicit permissions");
        return "PASS";
    } else {
        console.log(`    ✗ FAIL — ${withoutPerms} workflow(s) missing explicit permissions block`);
        return "FAIL";
    }
}

// ─── check 2: default workflow permissions via gh API (best-effort) ─────────

function checkDefaultPermissions(repo) {
    console.log("");
    console.log("  ── Default Workflow Permissions (best-effort) ──");

    if (!ghExists()) {
        console.log("    ⚠ gh CLI not found. Skipping API-based permission check.");
        console.log("      Install: https://cli.github.com/");
        return "SKIP";
    }

    if (!ghAuthenticated()) {
        console.log("    ⚠ gh CLI not authenticated. Skipping API-based permission check.");
        console.log("      Run: gh auth login");
        return "SKIP";
    }

    if (!repo) {
        console.log("    ⚠ Cannot determine GitHub repository.");
        return "UNKNOWN";
    }

    const endpoint = `repos/${repo}/actions/permissions/workflow`;
    const raw = run(`gh api ${endpoint}`);
    if (!raw) {
        console.log(`    ⚠ Could not fetch workflow permissions from: ${endpoint}`);
        console.log("      This may require admin/owner access to the repository.");
        console.log(`      Manual check: gh api ${endpoint}`);
        return "UNKNOWN";
    }

    try {
        const perms = JSON.parse(raw);
        const defaultPerms = perms.default_workflow_permissions || "unknown";
        const canApprove = perms.can_approve_pull_request_reviews;

        console.log(`    default_workflow_permissions: ${defaultPerms}`);
        console.log(`    can_approve_pull_request_reviews: ${canApprove ?? "unknown"}`);

        if (defaultPerms === "read") {
            console.log("    ✓ PASS — default is read-only (least privilege)");
            return "PASS";
        } else if (defaultPerms === "write") {
            console.log("    ✗ FAIL — default is read-write; prefer 'read' with explicit per-job permissions");
            return "FAIL";
        } else {
            console.log("    ⚠ Could not determine default permissions.");
            console.log(`      Manual check: gh api ${endpoint}`);
            return "UNKNOWN";
        }
    } catch (e) {
        console.log(`    ⚠ Failed to parse permissions response from: ${endpoint}`);
        console.log(`      Error: ${e.message}`);
        console.log(`      Manual check: gh api ${endpoint}`);
        return "UNKNOWN";
    }
}

// ─── main ───────────────────────────────────────────────────────────────────

function main() {
    const repo = detectRepo();

    console.log("");
    console.log("🔍 GitHub Actions Permissions Verification");
    console.log("─".repeat(50));
    console.log(`  Repository: ${repo || "(unknown)"}`);
    console.log("");

    const workflowResult = checkWorkflowPermissions();
    const apiResult = checkDefaultPermissions(repo);

    // ── Determine overall status ──
    //
    // Key rule: if ALL workflow files have explicit `permissions:` blocks (PASS),
    // the overall result is PASS regardless of the API check being UNKNOWN/SKIP,
    // because the workflow-level declarations override repo defaults.
    //
    // If either check is FAIL, overall is FAIL.

    let overall;

    if (workflowResult === "FAIL" || apiResult === "FAIL") {
        overall = "FAIL";
    } else if (workflowResult === "PASS") {
        // Workflow files all have explicit permissions — this is sufficient.
        // API check being UNKNOWN/SKIP doesn't downgrade the overall result.
        overall = "PASS";

        if (apiResult !== "PASS") {
            console.log("");
            console.log("  ⚠ Note: repo default workflow permissions could not be determined via API.");
            console.log(`    To verify manually: gh api repos/${repo || "{owner}/{repo}"}/actions/permissions/workflow`);
            console.log("    Since all workflow files declare explicit permissions, this is non-blocking.");
        }
    } else {
        // Workflow files scan is not PASS (UNKNOWN/SKIP) — fall back to normal priority
        if ([workflowResult, apiResult].includes("UNKNOWN")) {
            overall = "UNKNOWN";
        } else if ([workflowResult, apiResult].includes("SKIP")) {
            overall = "SKIP";
        } else {
            overall = "PASS";
        }
    }

    console.log("");
    console.log(`  Summary: Workflow files=${workflowResult}  API check=${apiResult}  Overall=${overall}`);
    console.log("");

    // Exit codes: 0=PASS, 1=FAIL, 2=SKIP, 3=UNKNOWN
    const exitCodes = { PASS: 0, FAIL: 1, SKIP: 2, UNKNOWN: 3 };
    process.exit(exitCodes[overall] ?? 1);
}

main();
