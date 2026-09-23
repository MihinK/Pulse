import type { AuthStrategy, OutboundRequest } from "../application/ports/auth-strategy";

export class NoAuthStrategy implements AuthStrategy {
  public apply(request: OutboundRequest): OutboundRequest {
    return request;
  }
}

/** FR-APP-04: API key, sent as either a header or a query parameter. */
export class ApiKeyAuthStrategy implements AuthStrategy {
  public constructor(
    private readonly location: "header" | "query",
    private readonly name: string,
    private readonly value: string,
  ) {}

  public apply(request: OutboundRequest): OutboundRequest {
    if (this.location === "header") {
      return { ...request, headers: { ...request.headers, [this.name]: this.value } };
    }
    const url = new URL(request.url);
    url.searchParams.set(this.name, this.value);
    return { ...request, url: url.toString() };
  }
}

export class BearerAuthStrategy implements AuthStrategy {
  public constructor(private readonly token: string) {}

  public apply(request: OutboundRequest): OutboundRequest {
    return { ...request, headers: { ...request.headers, authorization: `Bearer ${this.token}` } };
  }
}

export class BasicAuthStrategy implements AuthStrategy {
  public constructor(
    private readonly username: string,
    private readonly password: string,
  ) {}

  public apply(request: OutboundRequest): OutboundRequest {
    const encoded = Buffer.from(`${this.username}:${this.password}`, "utf8").toString("base64");
    return { ...request, headers: { ...request.headers, authorization: `Basic ${encoded}` } };
  }
}
