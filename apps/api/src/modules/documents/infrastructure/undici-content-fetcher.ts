import { Inject, Injectable } from "@nestjs/common";
import { lookup } from "node:dns/promises";
import { request } from "undici";
import type { NetworkPolicy } from "../../applications/application/ports/network-policy";
import { NETWORK_POLICY } from "../../applications/applications.tokens";
import { ContentFetcher, ContentTooLargeError } from "../application/ports/content-fetcher";

const MAX_REDIRECTS = 5;

/**
 * Downloads a URL import (technical plan 8's SSRF defense — an Admin-supplied URL is exactly what
 * `NetworkPolicy` exists for). Same manual-redirect-loop shape as `UndiciHttpProbe` (re-resolves
 * and re-checks `NetworkPolicy` on every hop, not just the first), reusing the applications
 * module's port/token rather than standing up a second network policy.
 */
@Injectable()
export class UndiciContentFetcher implements ContentFetcher {
  public constructor(@Inject(NETWORK_POLICY) private readonly networkPolicy: NetworkPolicy) {}

  public async fetch(url: string, maxBytes: number): Promise<Buffer> {
    let currentUrl = url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await this.assertHostAllowed(currentUrl);

      const response = await request(currentUrl, { method: "GET" });

      const location = response.headers.location;
      if (isRedirectStatus(response.statusCode) && typeof location === "string") {
        await response.body.dump();
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      return this.readWithinLimit(response.body, maxBytes);
    }
    throw new Error("Too many redirects");
  }

  private async assertHostAllowed(url: string): Promise<void> {
    const { hostname } = new URL(url);
    const { address } = await lookup(hostname);
    this.networkPolicy.assertAllowed(address);
  }

  private async readWithinLimit(body: AsyncIterable<Uint8Array>, maxBytes: number): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of body) {
      total += chunk.byteLength;
      if (total > maxBytes) {
        throw new ContentTooLargeError(maxBytes);
      }
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}

function isRedirectStatus(statusCode: number): boolean {
  return statusCode >= 300 && statusCode < 400;
}
