import { describe, it, expect } from "vitest";

// Pure function copied from scripts/verify/webhook-signature-enforcement.mjs
// for unit testing without importing the CLI entry point (which has
// top-level await and emoji characters that break vitest transforms).
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
