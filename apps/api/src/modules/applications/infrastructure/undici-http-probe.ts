import { Inject, Injectable } from "@nestjs/common";
import { performance } from "node:perf_hooks";
import { lookup } from "node:dns/promises";
import { request } from "undici";
import type { HttpProbe, HttpProbeOptions, ProbeResult } from "../application/ports/http-probe";
import type { NetworkPolicy } from "../application/ports/network-policy";
import { NetworkPolicyViolationError } from "../application/ports/network-policy";
import { NETWORK_POLICY } from "../applications.tokens";

const MAX_REDIRECTS = 5;

/**
 * `redirect: manual` isn't an undici request option — the way undici gives manual control is
 * simply never passing `maxRedirections` (it defaults to not following), so a 3xx with a
 * `location` header comes back as a normal response here and this loop re-resolves + re-checks
 * `NetworkPolicy` on every hop itself (technical plan 4.2: the DNS-rebinding defense is
 * meaningless if a redirect is followed past it automatically).
 */
@Injectable()
export class UndiciHttpProbe implements HttpProbe {
  public constructor(@Inject(NETWORK_POLICY) private readonly networkPolicy: NetworkPolicy) {}

  public async probe(url: string, options: HttpProbeOptions): Promise<ProbeResult> {
    const start = performance.now();
    try {
      let currentUrl = url;
      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        await this.assertHostAllowed(currentUrl);

        const response = await request(currentUrl, {
          method: (options.method ?? "GET") as never,
          ...(options.headers ? { headers: options.headers } : {}),
          headersTimeout: options.timeoutMs,
          bodyTimeout: options.timeoutMs,
        });
        await response.body.dump();

        const location = response.headers.location;
        if (isRedirectStatus(response.statusCode) && typeof location === "string") {
          currentUrl = new URL(location, currentUrl).toString();
          continue;
        }

        return { statusCode: response.statusCode, responseMs: elapsedMs(start) };
      }
      return { responseMs: elapsedMs(start), error: "Too many redirects" };
    } catch (error) {
      return { responseMs: elapsedMs(start), error: describeError(error) };
    }
  }

  private async assertHostAllowed(url: string): Promise<void> {
    const { hostname } = new URL(url);
    const { address } = await lookup(hostname);
    this.networkPolicy.assertAllowed(address);
  }
}

function isRedirectStatus(statusCode: number): boolean {
  return statusCode >= 300 && statusCode < 400;
}

function elapsedMs(start: number): number {
  return Math.round(performance.now() - start);
}

function describeError(error: unknown): string {
  if (error instanceof NetworkPolicyViolationError) {
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}
