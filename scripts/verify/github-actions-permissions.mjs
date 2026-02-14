#!/usr/bin/env node
/**
 * scripts/verify/github-actions-permissions.mjs
 *
 * Cross-platform (Node) replacement for github-actions-permissions.sh.
 *
 * Verifies:
 *   1. GitHub Actions default_workflow_permissions are read-only (via gh CLI API)
 *   2. All .github/workflows/*.yml files have explicit `permissions:` blocks
 *
 * Requires: gh CLI authenticated (GITHUB_TOKEN or `gh auth login`)
 *
 * Exit codes:
 *   0 = all PASS (or SKIP when gh is unavailable)
 *   1 = at least one FAIL
 *   2 = SKIP (no gh CLI / not authenticated)
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

// ─── check 1: default workflow permissions via gh API ───────────────────────

function checkDefaultPermissions(repo) {
    console.log("  ── Default Workflow Permissions ──");

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

    const raw = run(`gh api repos/${repo}/actions/permissions`);
    if (!raw) {
        console.log("    ⚠ Could not fetch repo permissions (may need admin access).");
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
            console.log("    ⚠ Could not determine default permissions");
            return "UNKNOWN";
        }
    } catch {
        console.log("    ⚠ Failed to parse permissions response.");
        return "UNKNOWN";
    }
}

// ─── check 2: workflow files have explicit permissions blocks ────────────────

function checkWorkflowPermissions() {
    console.log("");
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

// ─── main ───────────────────────────────────────────────────────────────────

function main() {
    const repo = detectRepo();

    console.log("");
    console.log("🔍 GitHub Actions Permissions Verification");
    console.log("─".repeat(50));
    console.log(`  Repository: ${repo || "(unknown)"}`);
    console.log("");

    const result1 = checkDefaultPermissions(repo);
    const result2 = checkWorkflowPermissions();

    // Determine overall status
    // Priority: FAIL > UNKNOWN > SKIP > PASS
    const statuses = [result1, result2];
    let overall;
    if (statuses.includes("FAIL")) {
        overall = "FAIL";
    } else if (statuses.includes("UNKNOWN")) {
        overall = "UNKNOWN";
    } else if (statuses.includes("SKIP")) {
        overall = "SKIP";
    } else {
        overall = "PASS";
    }

    console.log("");
    console.log(`  Summary: API check=${result1}  Workflow files=${result2}  Overall=${overall}`);
    console.log("");

    // Exit codes: 0=PASS, 1=FAIL, 2=SKIP, 3=UNKNOWN
    const exitCodes = { PASS: 0, FAIL: 1, SKIP: 2, UNKNOWN: 3 };
    process.exit(exitCodes[overall] ?? 1);
}

main();
