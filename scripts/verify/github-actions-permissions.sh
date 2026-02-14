#!/usr/bin/env bash
# scripts/verify/github-actions-permissions.sh
#
# Verifies GitHub Actions repository permissions and that workflow files
# use explicit least-privilege permissions blocks.
#
# Requires: gh CLI authenticated (GITHUB_TOKEN or gh auth login)
# Repo:     floodsys/tulora-growth-engine (auto-detected from git remote)
#
# Exit code 0 = all PASS, 1 = any FAIL.

set -euo pipefail

REPO=""
PASS=0
FAIL=0
WARN=0

# ─── detect repo ─────────────────────────────────────────────────────────────
detect_repo() {
  if command -v gh &>/dev/null; then
    REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)
  fi
  if [ -z "$REPO" ]; then
    REPO=$(git remote get-url origin 2>/dev/null | sed -E 's#.*github\.com[:/](.+)\.git#\1#' || true)
  fi
  if [ -z "$REPO" ]; then
    echo "✗ Cannot determine GitHub repository. Set GITHUB_REPOSITORY or run from a git repo."
    exit 1
  fi
}

# ─── check 1: default_workflow_permissions ───────────────────────────────────
check_default_permissions() {
  echo ""
  echo "🔍 GitHub Actions Permissions Verification"
  echo "──────────────────────────────────────────────"
  echo "  Repository: $REPO"
  echo ""

  if ! command -v gh &>/dev/null; then
    echo "  ⚠ gh CLI not found. Skipping API-based permission check."
    echo "    Install: https://cli.github.com/"
    WARN=$((WARN + 1))
    return
  fi

  # Check if gh is authenticated
  if ! gh auth status &>/dev/null 2>&1; then
    echo "  ⚠ gh CLI not authenticated. Skipping API-based permission check."
    echo "    Run: gh auth login"
    WARN=$((WARN + 1))
    return
  fi

  echo "  ── Default Workflow Permissions ──"
  local perms
  perms=$(gh api "repos/$REPO/actions/permissions" 2>/dev/null || echo '{"error": true}')

  if echo "$perms" | grep -q '"error"'; then
    echo "    ⚠ Could not fetch repo permissions (may need admin access)"
    WARN=$((WARN + 1))
  else
    local default_perms
    default_perms=$(echo "$perms" | grep -o '"default_workflow_permissions":"[^"]*"' | cut -d'"' -f4)
    local can_approve
    can_approve=$(echo "$perms" | grep -o '"can_approve_pull_request_reviews":[^,}]*' | cut -d: -f2)

    echo "    default_workflow_permissions: ${default_perms:-unknown}"
    echo "    can_approve_pull_request_reviews: ${can_approve:-unknown}"

    if [ "$default_perms" = "read" ]; then
      echo "    ✓ PASS — default is read-only (least privilege)"
      PASS=$((PASS + 1))
    elif [ "$default_perms" = "write" ]; then
      echo "    ⚠ WARN — default is read-write; prefer 'read' with explicit per-job permissions"
      WARN=$((WARN + 1))
    else
      echo "    ℹ Could not determine default permissions"
      WARN=$((WARN + 1))
    fi
  fi
}

# ─── check 2: workflow files have explicit permissions ───────────────────────
check_workflow_permissions() {
  echo ""
  echo "  ── Workflow Permissions Blocks ──"

  local workflow_dir=".github/workflows"
  if [ ! -d "$workflow_dir" ]; then
    echo "    ⚠ No $workflow_dir directory found"
    WARN=$((WARN + 1))
    return
  fi

  local total=0
  local with_perms=0
  local without_perms=0

  for wf in "$workflow_dir"/*.yml "$workflow_dir"/*.yaml; do
    [ -f "$wf" ] || continue
    total=$((total + 1))
    local basename
    basename=$(basename "$wf")

    # Check for top-level or job-level permissions
    if grep -qE '^\s*permissions:' "$wf"; then
      echo "    ✓ $basename — has explicit permissions block"
      with_perms=$((with_perms + 1))
    else
      echo "    ✗ $basename — NO explicit permissions block"
      without_perms=$((without_perms + 1))
    fi
  done

  echo ""
  echo "    Total: $total  With permissions: $with_perms  Without: $without_perms"

  if [ "$without_perms" -eq 0 ] && [ "$total" -gt 0 ]; then
    echo "    ✓ PASS — all workflows have explicit permissions"
    PASS=$((PASS + 1))
  elif [ "$without_perms" -gt 0 ]; then
    echo "    ✗ FAIL — $without_perms workflow(s) missing explicit permissions block"
    FAIL=$((FAIL + 1))
  fi
}

# ─── main ────────────────────────────────────────────────────────────────────
detect_repo
check_default_permissions
check_workflow_permissions

echo ""
echo "  Summary: ✓ $PASS PASS  ✗ $FAIL FAIL  ⚠ $WARN WARN"
echo ""

exit $FAIL
