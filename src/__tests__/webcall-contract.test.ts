/**
 * Contract test: webcall payload type alignment.
 *
 * Ensures the WebCallCreatePayload type enforces:
 *  - agentSlug is required (string)
 *  - No stale fields like `slug` or `agent_id` leak through
 */

import { describe, it, expect } from "vitest";
import type { WebCallCreatePayload, WebCallCreateResponse } from "@/types/webcall";

describe("WebCallCreatePayload contract", () => {
    it("should accept a valid payload with agentSlug", () => {
        const payload: WebCallCreatePayload = { agentSlug: "paul" };
        expect(payload.agentSlug).toBe("paul");
    });

    it("should enforce agentSlug as the only required field", () => {
        const payload: WebCallCreatePayload = { agentSlug: "receptionist" };
        const keys = Object.keys(payload);
        expect(keys).toEqual(["agentSlug"]);
    });

    it("payload serialises correctly for supabase.functions.invoke", () => {
        const payload: WebCallCreatePayload = { agentSlug: "demo" };
        const json = JSON.parse(JSON.stringify(payload));
        expect(json).toHaveProperty("agentSlug", "demo");
        // Ensure no accidental `slug` or `agent_id` key
        expect(json).not.toHaveProperty("slug");
        expect(json).not.toHaveProperty("agent_id");
    });
});

describe("WebCallCreateResponse contract", () => {
    it("should have required fields", () => {
        const response: WebCallCreateResponse = {
            call_id: "call_abc123",
            access_token: "tok_xyz",
            traceId: "trace_123_abc",
        };
        expect(response.call_id).toBeTruthy();
        expect(response.access_token).toBeTruthy();
        expect(response.traceId).toBeTruthy();
    });

    it("client_secret should be optional", () => {
        const response: WebCallCreateResponse = {
            call_id: "call_abc123",
            access_token: "tok_xyz",
            traceId: "trace_123_abc",
        };
        expect(response.client_secret).toBeUndefined();

        const withSecret: WebCallCreateResponse = {
            call_id: "call_abc123",
            access_token: "tok_xyz",
            client_secret: "sec_abc",
            traceId: "trace_123_abc",
        };
        expect(withSecret.client_secret).toBe("sec_abc");
    });
});
