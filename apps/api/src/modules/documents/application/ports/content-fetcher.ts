/** Thrown when a URL import exceeds the upload size limit while streaming (technical plan's
 * security table: the 10 MB limit is enforced as the bytes arrive, not just after the fact). */
export class ContentTooLargeError extends Error {
  public constructor(limitBytes: number) {
    super(`Content exceeds the ${limitBytes} byte limit`);
    this.name = "ContentTooLargeError";
  }
}

/**
 * Downloads a URL an Admin supplied for "import from URL" — exactly the shape of request SSRF
 * defenses exist for, so the implementation reuses `NetworkPolicy` (re-checked on every redirect
 * hop, the same way `UndiciHttpProbe` already does for health checks) rather than a new policy.
 */
export interface ContentFetcher {
  fetch(url: string, maxBytes: number): Promise<Buffer>;
}
