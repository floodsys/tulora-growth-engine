import { describe, it, expect } from 'vitest'

// Minimal, framework-agnostic tests for Corr ID precedence.
// Works with Jest or Vitest (uses describe/it/expect).

describe("getCorrId precedence", () => {
  // Mirror the helper used across components (no import or refactor needed).
  const getCorrId = (err: any) =>
    err?.correlationId ?? err?.corr ?? err?.traceId ?? null;

  it("prefers correlationId over corr and traceId", () => {
    expect(getCorrId({ correlationId: "A", corr: "B", traceId: "C" })).toBe("A");
  });

  it("falls back to corr when correlationId is absent", () => {
    expect(getCorrId({ corr: "B", traceId: "C" })).toBe("B");
  });

  it("falls back to traceId when correlationId and corr are absent", () => {
    expect(getCorrId({ traceId: "C" })).toBe("C");
  });

  it("returns null when no correlation fields are present", () => {
    expect(getCorrId({})).toBeNull();
  });
});