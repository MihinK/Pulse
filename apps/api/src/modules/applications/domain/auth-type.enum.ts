/**
 * OAUTH2_CC and LOGIN_FLOW are part of the data model from the start (technical plan section 4.1)
 * but have no {@link AuthStrategy} implementation until sprint 5 — `AuthConfigService` rejects
 * them for now (see its constructor-only allow-list).
 */
export enum AuthType {
  NONE = "NONE",
  API_KEY = "API_KEY",
  BEARER = "BEARER",
  BASIC = "BASIC",
  OAUTH2_CC = "OAUTH2_CC",
  LOGIN_FLOW = "LOGIN_FLOW",
}
