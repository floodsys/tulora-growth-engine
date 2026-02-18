import { describe, it, expect } from "vitest";

// ─── Pure-function copies from scripts/verify/webhook-signature-enforcement.mjs ───
// Duplicated here for unit testing without importing the CLI entry point
// (which has top-level await and emoji characters that break vitest transforms).

function interpretProbeStatus(
    status: number
): { verdict: string; reason: string } {
    if (status === 400 || status === 401 || status === 403) {
        return {
            verdict: "PASS",
            reason: "Rejected with " + status + " (signature required)",
        };
    }
    if (status >= 200 && status < 300) {
        return {
            verdict: "FAIL",
            reason:
                "Accepted unsigned request with " +
                status +
                " -- signature NOT enforced",
        };
    }
    if (status === 404) {
        return {
            verdict: "FAIL",
            reason: "Route not found (404) -- function not deployed",
        };
    }
    if (status >= 500) {
        return {
            verdict: "FAIL",
            reason:
                "Server error " +
                status +
                " -- likely misconfigured secret or crash",
        };
    }
    if (status >= 400 && status < 500) {
        return {
            verdict: "PASS",
            reason: "Rejected with " + status + " (non-standard but acceptable)",
        };
    }
    return { verdict: "FAIL", reason: "Unexpected status " + status };
}

/**
 * Redact secrets/tokens from a URL for safe logging (mirrors the script's redactUrl).
 */
function redactUrl(url: string): string {
    try {
        const u = new URL(url);
        if (u.password) u.password = "***";
        for (const key of u.searchParams.keys()) {
            if (/secret|token|key|password/i.test(key)) {
                u.searchParams.set(key, "***");
            }
        }
        return u.toString();
    } catch {
        return url.replace(
            /([?&](?:secret|token|key|password)[=])[^&]*/gi,
            "$1***"
        );
    }
}

/**
 * evaluateEndpointResult — mirrors the exported function in the verifier.
 *
 * In strict-runtime mode the source code fallback is NEVER used.
 */
function evaluateEndpointResult({
    status,
    strictRuntime,
    sourceHasEnforcement,
    endpointLabel,
    endpointUrl,
}: {
    status: number;
    strictRuntime: boolean;
    sourceHasEnforcement: boolean;
    endpointLabel: string;
    endpointUrl: string;
}): { verdict: string; reason: string; usedFallback: boolean } {
    const probe = interpretProbeStatus(status);
    const redacted = redactUrl(endpointUrl || "");

    if (probe.verdict === "PASS") {
        return { verdict: "PASS", reason: probe.reason, usedFallback: false };
    }

    // Probe indicates a problem — decide based on mode
    if (strictRuntime) {
        const is2xx = status >= 200 && status < 300;
        const failMsg = is2xx
            ? `FAIL: deployed webhook accepted unsigned request (status ${status})`
            : `FAIL: probe returned non-passing status ${status}`;
        return {
            verdict: "FAIL",
            reason: `${failMsg} | endpoint=${endpointLabel} url=${redacted}`,
            usedFallback: false,
        };
    }

    // Non-strict: allow source code fallback
    if (sourceHasEnforcement) {
        return {
            verdict: "PASS",
            reason:
                "Source code has enforcement (deployment pending) -- treated as PASS",
            usedFallback: true,
        };
    }

    return {
        verdict: "FAIL",
        reason: `${probe.reason} | endpoint=${endpointLabel} url=${redacted}`,
        usedFallback: false,
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("interpretProbeStatus", () => {
    it("returns PASS for 400 (Bad Request)", () => {
        expect(interpretProbeStatus(400).verdict).toBe("PASS");
    });

    it("returns PASS for 401 (Unauthorized)", () => {
        expect(interpretProbeStatus(401).verdict).toBe("PASS");
    });

    it("returns PASS for 403 (Forbidden)", () => {
        expect(interpretProbeStatus(403).verdict).toBe("PASS");
    });

    it("returns PASS for 405 (other 4xx)", () => {
        expect(interpretProbeStatus(405).verdict).toBe("PASS");
    });

    it("returns PASS for 422 (other 4xx)", () => {
        expect(interpretProbeStatus(422).verdict).toBe("PASS");
    });

    it("returns PASS for 429 (rate limited)", () => {
        expect(interpretProbeStatus(429).verdict).toBe("PASS");
    });

    it("returns FAIL for 200 (accepted unsigned)", () => {
        const r = interpretProbeStatus(200);
        expect(r.verdict).toBe("FAIL");
        expect(r.reason).toContain("NOT enforced");
    });

    it("returns FAIL for 204 (accepted unsigned)", () => {
        expect(interpretProbeStatus(204).verdict).toBe("FAIL");
    });

    it("returns FAIL for 404 (not deployed)", () => {
        const r = interpretProbeStatus(404);
        expect(r.verdict).toBe("FAIL");
        expect(r.reason).toContain("not deployed");
    });

    it("returns FAIL for 500 (server error)", () => {
        const r = interpretProbeStatus(500);
        expect(r.verdict).toBe("FAIL");
        expect(r.reason).toContain("misconfigured");
    });

    it("returns FAIL for 502", () => {
        expect(interpretProbeStatus(502).verdict).toBe("FAIL");
    });

    it("returns FAIL for 503", () => {
        expect(interpretProbeStatus(503).verdict).toBe("FAIL");
    });

    it("returns FAIL for status 0 (network error)", () => {
        expect(interpretProbeStatus(0).verdict).toBe("FAIL");
    });

    it("returns a reason string for every status", () => {
        for (const code of [200, 204, 400, 401, 403, 404, 405, 500, 502]) {
            const r = interpretProbeStatus(code);
            expect(typeof r.reason).toBe("string");
            expect(r.reason.length).toBeGreaterThan(0);
        }
    });
});

// ─── evaluateEndpointResult tests ─────────────────────────────────────────────

describe("evaluateEndpointResult", () => {
    const base = {
        endpointLabel: "test-webhook",
        endpointUrl: "https://example.com/functions/v1/test-webhook",
    };

    describe("strict-runtime mode", () => {
        it("treats 200 as hard FAIL even when source has enforcement", () => {
            const r = evaluateEndpointResult({
                ...base,
                status: 200,
                strictRuntime: true,
                sourceHasEnforcement: true,
            });
            expect(r.verdict).toBe("FAIL");
            expect(r.usedFallback).toBe(false);
            expect(r.reason).toContain(
                "FAIL: deployed webhook accepted unsigned request (status 200)"
            );
            expect(r.reason).toContain("endpoint=test-webhook");
        });

        it("treats 204 as hard FAIL in strict mode", () => {
            const r = evaluateEndpointResult({
                ...base,
                status: 204,
                strictRuntime: true,
                sourceHasEnforcement: true,
            });
            expect(r.verdict).toBe("FAIL");
            expect(r.reason).toContain("status 204");
        });

        it("treats 404 as hard FAIL in strict mode (no fallback)", () => {
            const r = evaluateEndpointResult({
                ...base,
                status: 404,
                strictRuntime: true,
                sourceHasEnforcement: true,
            });
            expect(r.verdict).toBe("FAIL");
            expect(r.usedFallback).toBe(false);
        });

        it("treats 500 as hard FAIL in strict mode (no fallback)", () => {
            const r = evaluateEndpointResult({
                ...base,
                status: 500,
                strictRuntime: true,
                sourceHasEnforcement: true,
            });
            expect(r.verdict).toBe("FAIL");
            expect(r.usedFallback).toBe(false);
        });

        it("still returns PASS for 401 in strict mode (probe succeeded)", () => {
            const r = evaluateEndpointResult({
                ...base,
                status: 401,
                strictRuntime: true,
                sourceHasEnforcement: false,
            });
            expect(r.verdict).toBe("PASS");
        });

        it("never sets usedFallback=true in strict mode", () => {
            for (const status of [200, 204, 404, 500, 502, 0]) {
                const r = evaluateEndpointResult({
                    ...base,
                    status,
                    strictRuntime: true,
                    sourceHasEnforcement: true,
                });
                expect(r.usedFallback).toBe(false);
            }
        });

        it("includes endpoint name and URL in FAIL reason", () => {
            const r = evaluateEndpointResult({
                ...base,
                status: 200,
                strictRuntime: true,
                sourceHasEnforcement: false,
            });
            expect(r.reason).toContain("endpoint=test-webhook");
            expect(r.reason).toContain("url=");
        });
    });

    describe("non-strict mode", () => {
        it("allows fallback to PASS when source has enforcement", () => {
            const r = evaluateEndpointResult({
                ...base,
                status: 200,
                strictRuntime: false,
                sourceHasEnforcement: true,
            });
            expect(r.verdict).toBe("PASS");
            expect(r.usedFallback).toBe(true);
        });

        it("still FAILs in non-strict when source lacks enforcement", () => {
            const r = evaluateEndpointResult({
                ...base,
                status: 200,
                strictRuntime: false,
                sourceHasEnforcement: false,
            });
            expect(r.verdict).toBe("FAIL");
            expect(r.usedFallback).toBe(false);
        });

        it("returns PASS directly when probe succeeds (no fallback needed)", () => {
            const r = evaluateEndpointResult({
                ...base,
                status: 401,
                strictRuntime: false,
                sourceHasEnforcement: false,
            });
            expect(r.verdict).toBe("PASS");
            expect(r.usedFallback).toBe(false);
        });

        it("fallback only reachable in non-strict mode", () => {
            // Strict mode with same inputs should NOT use fallback
            const strict = evaluateEndpointResult({
                ...base,
                status: 500,
                strictRuntime: true,
                sourceHasEnforcement: true,
            });
            const nonStrict = evaluateEndpointResult({
                ...base,
                status: 500,
                strictRuntime: false,
                sourceHasEnforcement: true,
            });

            expect(strict.usedFallback).toBe(false);
            expect(strict.verdict).toBe("FAIL");

            expect(nonStrict.usedFallback).toBe(true);
            expect(nonStrict.verdict).toBe("PASS");
        });
    });
});
