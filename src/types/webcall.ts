/**
 * Shared types for the retell-webcall-create contract.
 *
 * Both the client (useRetellWebCall) and the Edge Function
 * (retell-webcall-create) must agree on the shape of the
 * request payload.  Keeping it in one place prevents drift.
 */

/** Payload sent from the client to `retell-webcall-create`. */
export interface WebCallCreatePayload {
    /** Human-readable agent slug resolved server-side to an agent_id. */
    agentSlug: string;
}

/** Successful response from `retell-webcall-create`. */
export interface WebCallCreateResponse {
    call_id: string;
    access_token: string;
    client_secret?: string;
    traceId: string;
}
