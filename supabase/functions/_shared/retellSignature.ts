/**
 * Retell webhook signature verification utilities.
 *
 * Uses HMAC-SHA256 with timing-safe comparison to prevent side-channel attacks.
 * Extracted into _shared so the verification logic can be unit-tested without
 * triggering the serve() side-effect in the webhook entrypoint.
 */

import { timingSafeEqual } from "https://deno.land/std@0.168.0/crypto/timing_safe_equal.ts";

/**
 * Convert a hex string to a Uint8Array.
 * Returns null if the input is not valid hex.
 */
export function hexToBytes(hex: string): Uint8Array | null {
    if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) return null;
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
}

/**
 * Verify Retell webhook signature using HMAC-SHA256 with timing-safe comparison.
 *
 * @param signature - The x-retell-signature header value (hex, optionally prefixed with "sha256=")
 * @param body      - Raw request body string
 * @param secret    - Retell webhook secret / API key
 * @returns true if the signature is valid
 */
export async function verifyWebhookSignature(
    signature: string,
    body: string,
    secret: string,
): Promise<boolean> {
    try {
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            "raw",
            encoder.encode(secret),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"],
        );

        const expectedSignature = new Uint8Array(
            await crypto.subtle.sign("HMAC", key, encoder.encode(body)),
        );

        // Remove 'sha256=' prefix if present
        const cleanSignature = signature.replace("sha256=", "");

        // Convert received hex signature to bytes for timing-safe comparison
        const receivedBytes = hexToBytes(cleanSignature);
        if (!receivedBytes || receivedBytes.length !== expectedSignature.length) {
            return false;
        }

        // Timing-safe comparison to prevent side-channel attacks
        return timingSafeEqual(receivedBytes, expectedSignature);
    } catch (error) {
        console.error("Error verifying webhook signature:", error);
        return false;
    }
}
