/** A single outbound HTTP request, mutated in place by an {@link AuthStrategy}. */
export interface OutboundRequest {
  url: string;
  headers: Record<string, string>;
}

/**
 * Applies one application's auth configuration to an outbound probe request. Implementations:
 * `NoAuthStrategy`, `ApiKeyAuthStrategy`, `BearerAuthStrategy`, `BasicAuthStrategy` — registered
 * by `auth_configs.type` (`OAUTH2_CC`/`LOGIN_FLOW` have no strategy yet, sprint 5).
 */
export interface AuthStrategy {
  apply(request: OutboundRequest): OutboundRequest;
}
