#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# ci-supabase-start-retry.sh
#
# Wraps `supabase start` in a retry loop to handle transient container /
# Docker-daemon timing issues that cause CI flakes.
#
# Usage:  bash scripts/ci-supabase-start-retry.sh [supabase-bin]
#   supabase-bin  defaults to "npx --yes supabase@2.76.6"
# ---------------------------------------------------------------------------
set -euo pipefail

SUPABASE="${1:-npx --yes supabase@2.76.6}"
MAX_ATTEMPTS=3
BACKOFF=(5 10 20)          # seconds between retries
HEALTH_RETRIES=6           # post-start health probes
HEALTH_INTERVAL=5          # seconds between probes

# ---------------------------------------------------------------------------
log()  { echo "🔄 [ci-start-retry] $*"; }
ok()   { echo "✅ [ci-start-retry] $*"; }
fail() { echo "❌ [ci-start-retry] $*"; }
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Health probe: verify Postgres is accepting connections after start
# ---------------------------------------------------------------------------
health_check() {
  log "Running post-start health probe..."
  local attempt=0
  while (( attempt < HEALTH_RETRIES )); do
    attempt=$((attempt + 1))
    if psql postgresql://postgres:postgres@localhost:54322/postgres \
         -c "SELECT 1 AS health;" >/dev/null 2>&1; then
      ok "Health probe passed (attempt $attempt/$HEALTH_RETRIES)"
      return 0
    fi
    log "Health probe attempt $attempt/$HEALTH_RETRIES failed — waiting ${HEALTH_INTERVAL}s..."
    sleep "$HEALTH_INTERVAL"
  done
  fail "Health probe failed after $HEALTH_RETRIES attempts"
  return 1
}

# ---------------------------------------------------------------------------
# Main retry loop
# ---------------------------------------------------------------------------
main() {
  local attempt=0
  local exit_code=0
  local output=""

  while (( attempt < MAX_ATTEMPTS )); do
    attempt=$((attempt + 1))
    log "Attempt $attempt/$MAX_ATTEMPTS — running: $SUPABASE start"

    set +e
    output=$($SUPABASE start 2>&1)
    exit_code=$?
    set -e

    # Print full output for CI visibility
    echo "$output"

    if (( exit_code == 0 )); then
      ok "supabase start succeeded on attempt $attempt"
      if health_check; then
        ok "Local stack is healthy — ready to proceed"
        return 0
      else
        fail "supabase start reported success but health check failed"
        # Try stopping and restarting
        log "Stopping Supabase before retry..."
        $SUPABASE stop --no-backup 2>&1 || true
      fi
    else
      log "supabase start failed (exit $exit_code)"
      echo "$output"
      # Try stopping to clean up before retry
      log "Stopping Supabase before retry..."
      $SUPABASE stop --no-backup 2>&1 || true
    fi

    if (( attempt < MAX_ATTEMPTS )); then
      local wait=${BACKOFF[$((attempt - 1))]}
      log "Waiting ${wait}s before retry..."
      sleep "$wait"
    fi
  done

  fail "Exhausted all $MAX_ATTEMPTS attempts to start Supabase"
  return 1
}

main "$@"
