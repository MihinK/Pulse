import { UndiciContentFetcher } from "./undici-content-fetcher";
import { ContentTooLargeError } from "../application/ports/content-fetcher";
import { NetworkPolicyViolationError, type NetworkPolicy } from "../../applications/application/ports/network-policy";

const lookupMock = jest.fn<Promise<{ address: string }>, [string]>();
jest.mock("node:dns/promises", () => ({
  lookup: (hostname: string): Promise<{ address: string }> => lookupMock(hostname),
}));

const requestMock = jest.fn<Promise<unknown>, [string, Record<string, unknown>]>();
jest.mock("undici", () => ({
  request: (url: string, options: Record<string, unknown>): Promise<unknown> => requestMock(url, options),
}));

async function* bodyOf(...chunks: string[]): AsyncGenerator<Uint8Array> {
  for (const chunk of chunks) {
    yield Buffer.from(chunk);
  }
}

describe("UndiciContentFetcher", () => {
  beforeEach(() => {
    lookupMock.mockReset();
    requestMock.mockReset();
  });

  function build() {
    const networkPolicy: jest.Mocked<NetworkPolicy> = { assertAllowed: jest.fn() };
    return { fetcher: new UndiciContentFetcher(networkPolicy), networkPolicy };
  }

  it("downloads content within the byte limit", async () => {
    const { fetcher } = build();
    lookupMock.mockResolvedValue({ address: "93.184.216.34" });
    requestMock.mockResolvedValue({ statusCode: 200, headers: {}, body: bodyOf("hello", " world") });

    const result = await fetcher.fetch("https://example.test/spec.yaml", 1024);

    expect(result.toString("utf8")).toBe("hello world");
  });

  it("checks network policy on the resolved IP before requesting", async () => {
    const { fetcher, networkPolicy } = build();
    lookupMock.mockResolvedValue({ address: "93.184.216.34" });
    requestMock.mockResolvedValue({ statusCode: 200, headers: {}, body: bodyOf("hi") });

    await fetcher.fetch("https://example.test/spec.yaml", 1024);

    expect(networkPolicy.assertAllowed).toHaveBeenCalledWith("93.184.216.34");
  });

  it("re-checks network policy on every redirect hop", async () => {
    const { fetcher, networkPolicy } = build();
    lookupMock.mockResolvedValueOnce({ address: "93.184.216.34" }).mockResolvedValueOnce({ address: "1.1.1.1" });
    requestMock
      .mockResolvedValueOnce({
        statusCode: 302,
        headers: { location: "https://other.test/next" },
        body: { dump: jest.fn().mockResolvedValue(undefined) },
      })
      .mockResolvedValueOnce({ statusCode: 200, headers: {}, body: bodyOf("ok") });

    const result = await fetcher.fetch("https://example.test/spec.yaml", 1024);

    expect(result.toString("utf8")).toBe("ok");
    expect(networkPolicy.assertAllowed).toHaveBeenCalledTimes(2);
    expect(networkPolicy.assertAllowed).toHaveBeenNthCalledWith(2, "1.1.1.1");
  });

  it("rejects when the network policy blocks the resolved address", async () => {
    const { fetcher, networkPolicy } = build();
    lookupMock.mockResolvedValue({ address: "127.0.0.1" });
    networkPolicy.assertAllowed.mockImplementation(() => {
      throw new NetworkPolicyViolationError("127.0.0.1");
    });

    await expect(fetcher.fetch("http://internal.test/spec.yaml", 1024)).rejects.toThrow(
      NetworkPolicyViolationError,
    );
  });

  it("aborts once the downloaded content exceeds the byte limit", async () => {
    const { fetcher } = build();
    lookupMock.mockResolvedValue({ address: "93.184.216.34" });
    requestMock.mockResolvedValue({ statusCode: 200, headers: {}, body: bodyOf("a".repeat(10), "b".repeat(10)) });

    await expect(fetcher.fetch("https://example.test/spec.yaml", 15)).rejects.toThrow(ContentTooLargeError);
  });

  it("gives up after too many redirects", async () => {
    const { fetcher } = build();
    lookupMock.mockResolvedValue({ address: "93.184.216.34" });
    requestMock.mockResolvedValue({
      statusCode: 302,
      headers: { location: "https://example.test/next" },
      body: { dump: jest.fn().mockResolvedValue(undefined) },
    });

    await expect(fetcher.fetch("https://example.test/spec.yaml", 1024)).rejects.toThrow("Too many redirects");
  });
});
