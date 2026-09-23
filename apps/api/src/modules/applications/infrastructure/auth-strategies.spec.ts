import {
  ApiKeyAuthStrategy,
  BasicAuthStrategy,
  BearerAuthStrategy,
  NoAuthStrategy,
} from "./auth-strategies";

describe("NoAuthStrategy", () => {
  it("passes the request through unchanged", () => {
    const request = { url: "https://api.acme.test", headers: { a: "b" } };

    expect(new NoAuthStrategy().apply(request)).toEqual(request);
  });
});

describe("ApiKeyAuthStrategy", () => {
  it("adds the key as a header", () => {
    const strategy = new ApiKeyAuthStrategy("header", "x-api-key", "secret");

    const result = strategy.apply({ url: "https://api.acme.test", headers: {} });

    expect(result.headers).toEqual({ "x-api-key": "secret" });
    expect(result.url).toBe("https://api.acme.test");
  });

  it("adds the key as a query parameter", () => {
    const strategy = new ApiKeyAuthStrategy("query", "api_key", "secret");

    const result = strategy.apply({ url: "https://api.acme.test/health", headers: {} });

    expect(result.url).toBe("https://api.acme.test/health?api_key=secret");
  });
});

describe("BearerAuthStrategy", () => {
  it("adds an authorization header", () => {
    const strategy = new BearerAuthStrategy("my-token");

    const result = strategy.apply({ url: "https://api.acme.test", headers: {} });

    expect(result.headers.authorization).toBe("Bearer my-token");
  });
});

describe("BasicAuthStrategy", () => {
  it("adds a base64-encoded authorization header", () => {
    const strategy = new BasicAuthStrategy("user", "pass");

    const result = strategy.apply({ url: "https://api.acme.test", headers: {} });

    expect(result.headers.authorization).toBe(`Basic ${Buffer.from("user:pass").toString("base64")}`);
  });
});
