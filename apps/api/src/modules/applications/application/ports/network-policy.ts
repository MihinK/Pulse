/** Thrown by {@link NetworkPolicy.assertAllowed} when an IP is outside the allowed range. */
export class NetworkPolicyViolationError extends Error {
  public constructor(ip: string) {
    super(`Address ${ip} is not allowed by network policy`);
    this.name = "NetworkPolicyViolationError";
  }
}

/**
 * A pure function over an already-resolved IP (technical plan section 8.1, SSRF defense). The DNS
 * lookup and per-redirect re-check live in `UndiciHttpProbe`, the only place that actually needs
 * them — this port stays table-driven-unit-testable with no DNS/network involved.
 */
export interface NetworkPolicy {
  /** @throws {NetworkPolicyViolationError} if `ip` is private/loopback/link-local/metadata. */
  assertAllowed(ip: string): void;
}
