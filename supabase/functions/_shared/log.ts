/**
 * Shared logging & redaction utilities for Edge Functions.
 *
 * RULES:
 *   • correlationId, event_type, status_code, timings, truncated IDs → OK
 *   • raw auth headers, webhook signatures, full payloads, PII → NEVER
 *
 * Usage:
 *   import { redactHeaders, safeJson, logInfo, logWarn, logError } from '../_shared/log.ts'
 */

// Keys whose values must never appear in logs
const SENSITIVE_KEY_RE =
    /^(authorization|cookie|x-retell-signature|stripe-signature|apikey|x-api-key|x-internal-secret|set-cookie|proxy-authorization)$/i;

// Deep-redact pattern: any object key matching these tokens
const DEEP_REDACT_KEY_RE =
    /(token|secret|signature|authorization|cookie|apikey|password|credential|session_id|access_token|refresh_token|api_key|private_key|client_secret)/i;

// PII keys that should be redacted in payloads
const PII_KEY_RE =
    /^(email|email1|phone|phone_work|phone_mobile|phone_home|full_name|first_name|last_name|address|ssn|date_of_birth|ip_address)$/i;

const REDACTED = '[REDACTED]';

/**
 * Return a plain object copy of the Headers map with sensitive
 * header values replaced by '[REDACTED]'.
 */
export function redactHeaders(
    headers: Headers | Record<string, string>,
): Record<string, string> {
    const safe: Record<string, string> = {};
    const entries =
        headers instanceof Headers
            ? Array.from(headers.entries())
            : Object.entries(headers);

    for (const [key, value] of entries) {
        safe[key] = SENSITIVE_KEY_RE.test(key) ? REDACTED : value;
    }
    return safe;
}

/**
 * Deep-clone `obj` and replace any values whose key matches the
 * sensitive/PII patterns with '[REDACTED]'.  Handles nested objects
 * and arrays; stops at depth 10 to prevent runaway recursion.
 */
export function safeJson(obj: unknown, maxDepth = 10): unknown {
    return _redactDeep(obj, 0, maxDepth);
}

function _redactDeep(val: unknown, depth: number, maxDepth: number): unknown {
    if (depth > maxDepth) return '[MAX_DEPTH]';
    if (val === null || val === undefined) return val;
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
        return val;
    }
    if (Array.isArray(val)) {
        return val.map((item) => _redactDeep(item, depth + 1, maxDepth));
    }
    if (typeof val === 'object') {
        const out: Record<string, unknown> = {};
        for (const [key, v] of Object.entries(val as Record<string, unknown>)) {
            if (DEEP_REDACT_KEY_RE.test(key) || PII_KEY_RE.test(key)) {
                out[key] = REDACTED;
            } else {
                out[key] = _redactDeep(v, depth + 1, maxDepth);
            }
        }
        return out;
    }
    return String(val);
}

/**
 * Truncate an ID to first `n` chars + ellipsis.  Useful for call_id, org_id, etc.
 */
export function truncId(id: string | null | undefined, n = 8): string {
    if (!id) return 'unknown';
    return id.length > n ? `${id.substring(0, n)}…` : id;
}

// ── Structured log wrappers ──────────────────────────────────────

interface LogMeta {
    corrId?: string;
    fn?: string;
    [key: string]: unknown;
}

function emit(level: string, meta: LogMeta): void {
    const ts = new Date().toISOString();
    const payload = { level, ts, ...meta };
    // Use safeJson to ensure no secrets leak even if caller passes them
    const safe = safeJson(payload);
    switch (level) {
        case 'warn':
            console.warn(JSON.stringify(safe));
            break;
        case 'error':
            console.error(JSON.stringify(safe));
            break;
        default:
            console.log(JSON.stringify(safe));
    }
}

export function logInfo(meta: LogMeta): void {
    emit('info', meta);
}

export function logWarn(meta: LogMeta): void {
    emit('warn', meta);
}

export function logError(meta: LogMeta): void {
    emit('error', meta);
}
