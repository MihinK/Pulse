export interface HttpProbeOptions {
  method?: string;
  timeoutMs: number;
  headers?: Record<string, string>;
}

export interface ProbeResult {
  /** Absent when the request never got a response (timeout, DNS failure, connection refused). */
  statusCode?: number;
  responseMs: number;
  /** Present only when the probe failed outright — a non-2xx/3xx status is not an "error". */
  error?: string;
}

/**
 * `UndiciHttpProbe` follows redirects manually (`redirect: 'manual'`) so `NetworkPolicy` can
 * re-check the resolved IP on every hop — required for the DNS-rebinding defense (technical plan
 * 4.2) to mean anything.
 */
export interface HttpProbe {
  probe(url: string, options: HttpProbeOptions): Promise<ProbeResult>;
}
