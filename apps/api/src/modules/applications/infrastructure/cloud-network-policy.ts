import { Injectable } from "@nestjs/common";
import { isIPv4, isIPv6 } from "node:net";
import { NetworkPolicy, NetworkPolicyViolationError } from "../application/ports/network-policy";

interface Ipv4Range {
  network: number;
  maskBits: number;
}

/**
 * SSRF defense (technical plan section 8.1, requirements 3.4): blocks loopback, private,
 * link-local, and cloud metadata (169.254.169.254) ranges — hand-rolled CIDR checks on Node's
 * built-in `net` module rather than a dependency, so the whole policy is auditable in one file. A
 * pure function over an already-resolved IP; DNS resolution and per-redirect re-checks live in
 * `UndiciHttpProbe`, the only place that needs them.
 */
@Injectable()
export class CloudNetworkPolicy implements NetworkPolicy {
  // RFC 5735/6890 special-use IPv4 ranges, plus the well-known cloud metadata address.
  private static readonly BLOCKED_IPV4_RANGES: Ipv4Range[] = [
    { network: ip4ToInt("0.0.0.0"), maskBits: 8 }, // "this" network
    { network: ip4ToInt("10.0.0.0"), maskBits: 8 }, // RFC 1918 private
    { network: ip4ToInt("100.64.0.0"), maskBits: 10 }, // carrier-grade NAT
    { network: ip4ToInt("127.0.0.0"), maskBits: 8 }, // loopback
    { network: ip4ToInt("169.254.0.0"), maskBits: 16 }, // link-local, incl. 169.254.169.254 metadata
    { network: ip4ToInt("172.16.0.0"), maskBits: 12 }, // RFC 1918 private
    { network: ip4ToInt("192.0.0.0"), maskBits: 24 }, // IETF protocol assignments
    { network: ip4ToInt("192.168.0.0"), maskBits: 16 }, // RFC 1918 private
    { network: ip4ToInt("198.18.0.0"), maskBits: 15 }, // benchmarking
    { network: ip4ToInt("224.0.0.0"), maskBits: 4 }, // multicast
    { network: ip4ToInt("240.0.0.0"), maskBits: 4 }, // reserved
  ];

  public assertAllowed(ip: string): void {
    if (isIPv4(ip)) {
      if (this.isBlockedIpv4(ip)) {
        throw new NetworkPolicyViolationError(ip);
      }
      return;
    }

    if (isIPv6(ip)) {
      if (this.isBlockedIpv6(ip)) {
        throw new NetworkPolicyViolationError(ip);
      }
      return;
    }

    throw new NetworkPolicyViolationError(ip);
  }

  private isBlockedIpv4(ip: string): boolean {
    const value = ip4ToInt(ip);
    return CloudNetworkPolicy.BLOCKED_IPV4_RANGES.some(({ network, maskBits }) =>
      isInRange(value, network, maskBits),
    );
  }

  private isBlockedIpv6(ip: string): boolean {
    const normalized = ip.toLowerCase();

    if (normalized === "::1" || normalized === "::") {
      return true;
    }
    if (normalized.startsWith("fe80:") || normalized.startsWith("fe8") || normalized.startsWith("fec")) {
      return true; // link-local (fe80::/10)
    }
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
      return true; // unique local (fc00::/7)
    }

    // IPv4-mapped (::ffff:a.b.c.d) — apply the IPv4 rules to the embedded address.
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
    if (mapped) {
      return this.isBlockedIpv4(mapped[1] as string);
    }

    return false;
  }
}

function ip4ToInt(ip: string): number {
  return ip
    .split(".")
    .reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function isInRange(value: number, network: number, maskBits: number): boolean {
  const mask = maskBits === 0 ? 0 : (0xffffffff << (32 - maskBits)) >>> 0;
  return (value & mask) === (network & mask);
}
