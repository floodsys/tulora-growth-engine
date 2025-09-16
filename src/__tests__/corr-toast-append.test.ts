import { describe, it, expect } from 'vitest'

// Tiny tests that assert the toast message-building pattern
// appends " (Corr ID: …)" exactly when a corr id exists and never double-appends.

describe("Corr ID toast append pattern", () => {
  const getCorrId = (err: any) =>
    err?.correlationId ?? err?.corr ?? err?.traceId ?? null;

  const appendCorr = (msg: string, corr: string | null) =>
    corr && !String(msg).includes("Corr ID:")
      ? `${msg} (Corr ID: ${corr})`
      : msg;

  // A tiny harness that mirrors the app pattern without importing app code.
  const buildToastMessage = (baseMessage: string, error: any) => {
    const corr = getCorrId(error);
    return appendCorr(baseMessage, corr);
  };

  it("appends Corr ID when correlationId is present", () => {
    const msg = buildToastMessage("Failed to save", { correlationId: "corr-123" });
    expect(msg).toBe("Failed to save (Corr ID: corr-123)");
  });

  it("appends Corr ID when only corr is present", () => {
    const msg = buildToastMessage("Failed to save", { corr: "corr-ABC" });
    expect(msg).toBe("Failed to save (Corr ID: corr-ABC)");
  });

  it("appends Corr ID when only traceId is present", () => {
    const msg = buildToastMessage("Failed to save", { traceId: "trace-9" });
    expect(msg).toBe("Failed to save (Corr ID: trace-9)");
  });

  it("does not append when no correlation fields exist", () => {
    const msg = buildToastMessage("Failed to save", {});
    expect(msg).toBe("Failed to save");
  });

  it("does not double-append if the message already contains Corr ID", () => {
    const base = "Failed to save (Corr ID: corr-XYZ)";
    const msg = buildToastMessage(base, { correlationId: "corr-XYZ" });
    expect(msg).toBe("Failed to save (Corr ID: corr-XYZ)");
  });
});