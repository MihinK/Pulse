/**
 * Injection tokens for the identity module's interfaces and configuration values, following the
 * pattern established by `modules/health/health.tokens.ts` in sprint 1.
 */
export const CLOCK = Symbol("IDENTITY_CLOCK");
export const ORGANIZATION_REPOSITORY = Symbol("ORGANIZATION_REPOSITORY");
export const USER_REPOSITORY = Symbol("USER_REPOSITORY");
export const INVITATION_REPOSITORY = Symbol("INVITATION_REPOSITORY");
export const REFRESH_TOKEN_REPOSITORY = Symbol("REFRESH_TOKEN_REPOSITORY");
export const PASSWORD_HASHER = Symbol("PASSWORD_HASHER");

/** Refresh token lifetime in milliseconds. */
export const REFRESH_TOKEN_TTL_MS = Symbol("REFRESH_TOKEN_TTL_MS");
/** Invitation link lifetime in milliseconds. */
export const INVITATION_TTL_MS = Symbol("INVITATION_TTL_MS");
