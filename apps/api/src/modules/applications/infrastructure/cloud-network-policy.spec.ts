import { CloudNetworkPolicy } from "./cloud-network-policy";
import { NetworkPolicyViolationError } from "../application/ports/network-policy";

describe("CloudNetworkPolicy", () => {
  const policy = new CloudNetworkPolicy();

  const blocked = [
    ["loopback", "127.0.0.1"],
    ["RFC1918 10.x", "10.0.0.5"],
    ["RFC1918 172.16.x", "172.16.5.5"],
    ["RFC1918 192.168.x", "192.168.1.1"],
    ["link-local", "169.254.1.1"],
    ["cloud metadata", "169.254.169.254"],
    ["carrier-grade NAT", "100.64.0.1"],
    ["multicast", "224.0.0.1"],
    ["reserved", "240.0.0.1"],
    ["this-network", "0.0.0.1"],
    ["IPv6 loopback", "::1"],
    ["IPv6 unspecified", "::"],
    ["IPv6 link-local", "fe80::1"],
    ["IPv6 unique local", "fd00::1"],
    ["IPv4-mapped loopback", "::ffff:127.0.0.1"],
  ] as const;

  it.each(blocked)("blocks %s (%s)", (_label, ip) => {
    expect(() => policy.assertAllowed(ip)).toThrow(NetworkPolicyViolationError);
  });

  const allowed = ["8.8.8.8", "1.1.1.1", "93.184.216.34", "2606:4700:4700::1111"] as const;

  it.each(allowed)("allows public address %s", (ip) => {
    expect(() => policy.assertAllowed(ip)).not.toThrow();
  });

  it("rejects a value that isn't a valid IP at all", () => {
    expect(() => policy.assertAllowed("not-an-ip")).toThrow(NetworkPolicyViolationError);
  });
});
