/**
 * Injection tokens for the applications module's interfaces, following the pattern established
 * by `modules/identity/identity.tokens.ts`. Not shared with identity's tokens even where the name
 * matches (e.g. `CLOCK`) — each module provides its own, matching Nest's module encapsulation.
 */
export const CLOCK = Symbol("APPLICATIONS_CLOCK");
export const APPLICATION_REPOSITORY = Symbol("APPLICATION_REPOSITORY");
export const AUTH_CONFIG_REPOSITORY = Symbol("AUTH_CONFIG_REPOSITORY");
export const CHECK_RUN_REPOSITORY = Symbol("CHECK_RUN_REPOSITORY");
export const CHECK_RESULT_REPOSITORY = Symbol("CHECK_RESULT_REPOSITORY");
export const OUTBOX_REPOSITORY = Symbol("OUTBOX_REPOSITORY");
export const AUDIT_LOG_REPOSITORY = Symbol("AUDIT_LOG_REPOSITORY");
export const SECRET_CIPHER = Symbol("SECRET_CIPHER");
export const NETWORK_POLICY = Symbol("NETWORK_POLICY");
export const HTTP_PROBE = Symbol("HTTP_PROBE");
export const QUEUE = Symbol("QUEUE");
