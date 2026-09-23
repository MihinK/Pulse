import { UndiciHttpProbe } from "./undici-http-probe";
import { NetworkPolicyViolationError, type NetworkPolicy } from "../application/ports/network-policy";

const lookupMock = jest.fn<Promise<{ address: string }>, [string]>();
jest.mock("node:dns/promises", () => ({
  lookup: (hostname: string): Promise<{ address: string }> => lookupMock(hostname),
}));

const requestMock = jest.fn<Promise<unknown>, [string, Record<string, unknown>]>();
jest.mock("undici", () => ({
  request: (url: string, options: Record<string, unknown>): Promise<unknown> => requestMock(url, options),
}));

describe("UndiciHttpProbe", () => {
  beforeEach(() => {
    lookupMock.mockReset();
    requestMock.mockReset();
  });

  function build() {
    const networkPolicy: jest.Mocked<NetworkPolicy> = { assertAllowed: jest.fn() };
    return { probe: new UndiciHttpProbe(networkPolicy), networkPolicy };
  }

  it("returns the status code and elapsed time for a direct 200", async () => {
    const { probe } = build();
    lookupMock.mockResolvedValue({ address: "93.184.216.34" });
    requestMock.mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: { dump: jest.fn().mockResolvedValue(undefined) },
    });

    const result = await probe.probe("https://api.acme.test", { timeoutMs: 5000 });

    expect(result.statusCode).toBe(200);
    expect(result.error).toBeUndefined();
    expect(result.responseMs).toBeGreaterThanOrEqual(0);
  });

  it("checks network policy on the resolved IP before requesting", async () => {
    const { probe, networkPolicy } = build();
    lookupMock.mockResolvedValue({ address: "93.184.216.34" });
    requestMock.mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: { dump: jest.fn().mockResolvedValue(undefined) },
    });

    await probe.probe("https://api.acme.test", { timeoutMs: 5000 });

    expect(networkPolicy.assertAllowed).toHaveBeenCalledWith("93.184.216.34");
  });

  it("re-checks network policy on every redirect hop", async () => {
    const { probe, networkPolicy } = build();
    lookupMock.mockResolvedValueOnce({ address: "93.184.216.34" }).mockResolvedValueOnce({ address: "1.1.1.1" });
    requestMock
      .mockResolvedValueOnce({
        statusCode: 302,
        headers: { location: "https://other.acme.test/next" },
        body: { dump: jest.fn().mockResolvedValue(undefined) },
      })
      .mockResolvedValueOnce({
        statusCode: 200,
        headers: {},
        body: { dump: jest.fn().mockResolvedValue(undefined) },
      });

    const result = await probe.probe("https://api.acme.test", { timeoutMs: 5000 });

    expect(result.statusCode).toBe(200);
    expect(networkPolicy.assertAllowed).toHaveBeenCalledTimes(2);
    expect(networkPolicy.assertAllowed).toHaveBeenNthCalledWith(2, "1.1.1.1");
  });

  it("returns an error result when network policy blocks the address", async () => {
    const { probe, networkPolicy } = build();
    lookupMock.mockResolvedValue({ address: "127.0.0.1" });
    networkPolicy.assertAllowed.mockImplementation(() => {
      throw new NetworkPolicyViolationError("127.0.0.1");
    });

    const result = await probe.probe("http://internal.acme.test", { timeoutMs: 5000 });

    expect(result.error).toContain("127.0.0.1");
    expect(result.statusCode).toBeUndefined();
    expect(requestMock).not.toHaveBeenCalled();
  });

  it("returns an error result when the request throws", async () => {
    const { probe } = build();
    lookupMock.mockResolvedValue({ address: "93.184.216.34" });
    requestMock.mockRejectedValue(new Error("connect ECONNREFUSED"));

    const result = await probe.probe("https://api.acme.test", { timeoutMs: 5000 });

    expect(result.error).toBe("connect ECONNREFUSED");
  });

  it("stringifies a non-Error rejection", async () => {
    const { probe } = build();
    lookupMock.mockResolvedValue({ address: "93.184.216.34" });
    requestMock.mockRejectedValue("socket hang up");

    const result = await probe.probe("https://api.acme.test", { timeoutMs: 5000 });

    expect(result.error).toBe("socket hang up");
  });

  it("omits the headers option entirely when none are given", async () => {
    const { probe } = build();
    lookupMock.mockResolvedValue({ address: "93.184.216.34" });
    requestMock.mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: { dump: jest.fn().mockResolvedValue(undefined) },
    });

    await probe.probe("https://api.acme.test", { timeoutMs: 5000 });

    const [, requestOptions] = requestMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(requestOptions).not.toHaveProperty("headers");
  });

  it("gives up after too many redirects", async () => {
    const { probe } = build();
    lookupMock.mockResolvedValue({ address: "93.184.216.34" });
    requestMock.mockResolvedValue({
      statusCode: 302,
      headers: { location: "https://api.acme.test/next" },
      body: { dump: jest.fn().mockResolvedValue(undefined) },
    });

    const result = await probe.probe("https://api.acme.test", { timeoutMs: 5000 });

    expect(result.error).toBe("Too many redirects");
  });
});
