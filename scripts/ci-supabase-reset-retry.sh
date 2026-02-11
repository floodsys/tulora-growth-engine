#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# ci-supabase-reset-retry.sh
#
# Wraps `supabase db reset` in a retry loop that distinguishes:
#   • migration SQL errors  → fail CI immediately (no retry)
#   • 502 / gateway / container timing → retry with exponential back-off
#
# Usage:  bash scripts/ci-supabase-reset-retry.sh [supabase-bin]
#   supabase-bin  defaults to "npx --yes supabase@2.76.6"
# ---------------------------------------------------------------------------
set -euo pipefail

SUPABASE="${1:-npx --yes supabase@2.76.6}"
MAX_ATTEMPTS=3
BACKOFF=(5 10 20)          # seconds between retries
HEALTH_RETRIES=6           # post-reset health probes
HEALTH_INTERVAL=5          # seconds between probes

# Patterns that indicate a real migration / SQL error (should NOT be retried)
MIGRATION_FAIL_PATTERNS=(
  "ERROR.*syntax error"
  "ERROR.*relation .* does not exist"
  "ERROR.*column .* does not exist"
  "ERROR.*duplicate key"
  "ERROR.*violates"
  "ERROR.*permission denied"
  "ERROR.*function .* does not exist"
  "ERROR.*type .* does not exist"
  "migration.*failed"
  "pgErr"
)

# Patterns that indicate a transient gateway / container error (safe to retry)
TRANSIENT_PATTERNS=(
  "502"
  "upstream"
  "connection refused"
  "connection reset"
  "ECONNREFUSED"
  "ECONNRESET"
  "socket hang up"
  "server closed the connection unexpectedly"
  "the database system is starting up"
  "could not connect to"
  "dial tcp"
  "i/o timeout"
)

# ---------------------------------------------------------------------------
log()  { echo "🔄 [ci-reset-retry] $*"; }
ok()   { echo "✅ [ci-reset-retry] $*"; }
fail() { echo "❌ [ci-reset-retry] $*"; }
# ---------------------------------------------------------------------------

is_migration_error() {
  local output="$1"
  for pat in "${MIGRATION_FAIL_PATTERNS[@]}"; do
    if echo "$output" | grep -qiE "$pat"; then
      return 0   # yes, it's a migration error
    fi
  done
  return 1       # not a migration error
}

is_transient_error() {
  local output="$1"
  for pat in "${TRANSIENT_PATTERNS[@]}"; do
    if echo "$output" | grep -qiE "$pat"; then
      return 0   # yes, it's transient
    fi
  done
  return 1       # not obviously transient
}

# ---------------------------------------------------------------------------
# Health probe: verify Postgres is accepting queries post-reset
# ---------------------------------------------------------------------------
health_check() {
  log "Running post-reset health probe..."
  local attempt=0
  while (( attempt < HEALTH_RETRIES )); do
    attempt=$((attempt + 1))
    # Use the Supabase-managed psql to run a trivial query
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
    log "Attempt $attempt/$MAX_ATTEMPTS — running: $SUPABASE db reset --debug"

    set +e
    output=$($SUPABASE db reset --debug 2>&1)
    exit_code=$?
    set -e

    # Print the full output for CI visibility
    echo "$output"

    if (( exit_code == 0 )); then
      ok "db reset succeeded on attempt $attempt"
      # Post-reset health probe
      if health_check; then
        ok "Database is healthy — ready to proceed"
        return 0
      else
        fail "db reset reported success but health check failed"
        # Treat as transient; allow retry if we have attempts left
        if (( attempt < MAX_ATTEMPTS )); then
          local wait=${BACKOFF[$((attempt - 1))]}
          log "Retrying in ${wait}s..."
          sleep "$wait"
          continue
        fi
        fail "Exhausted all $MAX_ATTEMPTS attempts (health check failure)"
        return 1
      fi
    fi

    # --- Failure triage ---
    if is_migration_error "$output"; then
      fail "Migration / SQL error detected — failing immediately (no retry)"
      return 1
    fi

    if is_transient_error "$output"; then
      log "Transient error detected (gateway / container timing)"
    else
      log "Unknown error — treating as transient for safety"
    fi

    if (( attempt < MAX_ATTEMPTS )); then
      local wait=${BACKOFF[$((attempt - 1))]}
      log "Waiting ${wait}s before retry..."
      sleep "$wait"
    fi
  done

  fail "Exhausted all $MAX_ATTEMPTS attempts"
  return 1
}

main "$@"
