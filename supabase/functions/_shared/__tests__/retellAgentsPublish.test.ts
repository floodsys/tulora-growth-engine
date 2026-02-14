/**
 * Smoke tests for retell-agents-publish
 *
 * Validates:
 *  1. The module compiles (catches undefined vars / missing imports)
 *  2. resolveWebhookTarget produces correct precedence logic
 *  3. Payload assembly produces required webhook_url field
 *
 * Run: deno test --allow-env supabase/functions/_shared/__tests__/retellAgentsPublish.test.ts
 */

import {
    assertEquals,
    assertNotEquals,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { describe, it } from "https://deno.land/std@0.208.0/testing/bdd.ts";

// Import the helper under test directly from org-guard (same import the publish fn uses)
import { resolveWebhookTarget } from "../org-guard.ts";

// =============================================================================
// resolveWebhookTarget — precedence tests
// =============================================================================

describe("resolveWebhookTarget", () => {
    it("should prefer agent webhook_url when both are present", () => {
        const result = resolveWebhookTarget({
            agent: { webhook_url: "https://agent.example.com/hook" },
            orgSettings: { webhook_url: "https://org.example.com/hook" },
        });
        assertEquals(result.url, "https://agent.example.com/hook");
        assertEquals(result.target, "agent");
    });

    it("should fall back to org webhook_url when agent has none", () => {
        const result = resolveWebhookTarget({
            agent: { webhook_url: undefined },
            orgSettings: { webhook_url: "https://org.example.com/hook" },
        });
        assertEquals(result.url, "https://org.example.com/hook");
        assertEquals(result.target, "org");
    });

    it("should return null when neither agent nor org have a webhook_url", () => {
        const result = resolveWebhookTarget({
            agent: {},
            orgSettings: {},
        });
        assertEquals(result.url, null);
        assertEquals(result.target, null);
    });

    it("should handle missing agent object", () => {
        const result = resolveWebhookTarget({ orgSettings: { webhook_url: "https://org.example.com/hook" } });
        assertEquals(result.url, "https://org.example.com/hook");
        assertEquals(result.target, "org");
    });

    it("should handle missing orgSettings object", () => {
        const result = resolveWebhookTarget({ agent: { webhook_url: "https://agent.example.com/hook" } });
        assertEquals(result.url, "https://agent.example.com/hook");
        assertEquals(result.target, "agent");
    });

    it("should handle both undefined", () => {
        const result = resolveWebhookTarget({});
        assertEquals(result.url, null);
        assertEquals(result.target, null);
    });

    it("should trim whitespace-only webhook_url and treat as absent", () => {
        const result = resolveWebhookTarget({
            agent: { webhook_url: "   " },
            orgSettings: { webhook_url: "https://org.example.com/hook" },
        });
        assertEquals(result.url, "https://org.example.com/hook");
        assertEquals(result.target, "org");
    });
});

// =============================================================================
// Compile guard — importing the publish module proves it has no syntax /
// undefined-var errors at the module level.
// We dynamically import to avoid triggering the serve() call which would block.
// =============================================================================

describe("retell-agents-publish compile guard", () => {
    it("should type-check the publish module via deno check (no undefined vars / missing imports)", async () => {
        // Use deno check as a subprocess to verify the module compiles without
        // actually executing serve() which would leak a TCP listener.
        const cmd = new Deno.Command("deno", {
            args: ["check", "supabase/functions/retell-agents-publish/index.ts"],
            stdout: "piped",
            stderr: "piped",
        });
        const { code, stderr } = await cmd.output();
        const errText = new TextDecoder().decode(stderr);
        if (code !== 0) {
            throw new Error(`deno check failed (exit ${code}):\n${errText}`);
        }
        assertEquals(code, 0);
    });
});

// =============================================================================
// Payload assembly — simulates the publish payload structure
// =============================================================================

describe("publish payload assembly", () => {
    it("should produce a config object with required fields", () => {
        // Simulate agent row from DB
        const agent = {
            name: "Test Agent",
            voice_id: "voice-123",
            voice_model: "eleven_labs",
            language: "en",
            voice_speed: 1.0,
            voice_temperature: 0.7,
            volume: 1.0,
            normalize_for_speech: true,
            backchannel_enabled: false,
            backchannel_frequency: 0.3,
            pronunciation_dict: null,
            max_call_duration_ms: 600000,
            end_call_after_silence_ms: 5000,
            begin_message_delay_ms: 0,
            voicemail_option: "disabled",
            data_storage_setting: "default",
            opt_in_signed_url: false,
            transfer_mode: "disabled",
            transfer_number: null,
            webhook_url: "https://agent.example.com/hook",
            settings: null,
        };

        // Build the config the same way the edge function does
        // deno-lint-ignore no-explicit-any
        const retellConfig: Record<string, any> = {
            agent_name: agent.name,
            voice_id: agent.voice_id,
            voice_model: agent.voice_model || "eleven_labs",
            language: agent.language,
            response_engine: { type: "retell_llm", llm_id: "retell-llm-general" },
            voice_settings: {
                speed: agent.voice_speed,
                temperature: agent.voice_temperature,
                volume: agent.volume,
                normalize_for_speech: agent.normalize_for_speech,
            },
            advanced_settings: {
                backchannel_enabled: agent.backchannel_enabled,
                backchannel_frequency: agent.backchannel_frequency,
                pronunciation_dictionary: agent.pronunciation_dict,
                max_call_duration_ms: agent.max_call_duration_ms,
                end_call_after_silence_ms: agent.end_call_after_silence_ms,
                begin_message_delay_ms: agent.begin_message_delay_ms,
            },
            telephony: { voicemail_option: agent.voicemail_option === "enabled" },
            privacy_and_storage: {
                data_storage_setting: agent.data_storage_setting,
                opt_in_signed_url: agent.opt_in_signed_url,
            },
        };

        // Webhook resolution
        const webhookResult = resolveWebhookTarget({
            agent: { webhook_url: agent.webhook_url },
            orgSettings: undefined,
        });
        if (webhookResult.url) {
            retellConfig.webhook_url = webhookResult.url;
        }

        // Verify required fields
        assertEquals(retellConfig.agent_name, "Test Agent");
        assertEquals(retellConfig.voice_id, "voice-123");
        assertNotEquals(retellConfig.response_engine, undefined);
        assertEquals(retellConfig.webhook_url, "https://agent.example.com/hook");
        assertEquals(webhookResult.target, "agent");
    });

    it("should attach org webhook when agent has no webhook_url", () => {
        const webhookResult = resolveWebhookTarget({
            agent: { webhook_url: undefined },
            orgSettings: { webhook_url: "https://org.example.com/hook" },
        });

        // deno-lint-ignore no-explicit-any
        const retellConfig: Record<string, any> = { agent_name: "Fallback Agent" };
        if (webhookResult.url) {
            retellConfig.webhook_url = webhookResult.url;
        }

        assertEquals(retellConfig.webhook_url, "https://org.example.com/hook");
        assertEquals(webhookResult.target, "org");
    });

    it("should omit webhook_url when neither source provides one", () => {
        const webhookResult = resolveWebhookTarget({
            agent: {},
            orgSettings: {},
        });

        // deno-lint-ignore no-explicit-any
        const retellConfig: Record<string, any> = { agent_name: "No Webhook Agent" };
        if (webhookResult.url) {
            retellConfig.webhook_url = webhookResult.url;
        }

        assertEquals(retellConfig.webhook_url, undefined);
        assertEquals(webhookResult.target, null);
    });
});

console.log("🧪 Running retellAgentsPublish.test.ts...");
