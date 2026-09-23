/**
 * A minimal, self-authored JSON Schema for the Postman v2.1 collection shape Pulse actually
 * reads — deliberately not the vendor's full official schema (would mean fetching it from
 * postman's servers, an offline/auditability tradeoff the plan rejects). Anything not listed
 * here (auth blocks, scripts, variables) is simply ignored by the walker below, not rejected.
 */
export const POSTMAN_V21_SCHEMA = {
  type: "object",
  required: ["info", "item"],
  properties: {
    info: {
      type: "object",
      required: ["schema"],
      properties: {
        schema: { type: "string" },
        name: { type: "string" },
      },
    },
    item: { type: "array", items: { $ref: "#/definitions/item" } },
  },
  definitions: {
    item: {
      type: "object",
      properties: {
        name: { type: "string" },
        item: { type: "array", items: { $ref: "#/definitions/item" } },
        request: {
          type: "object",
          properties: {
            method: { type: "string" },
          },
        },
        response: { type: "array" },
      },
    },
  },
} as const;

export interface PostmanUrl {
  raw?: string;
  path?: string[];
  query?: { key?: string; value?: unknown }[];
}

export interface PostmanBody {
  mode?: string;
  raw?: string;
}

export interface PostmanRequest {
  method?: string;
  url?: string | PostmanUrl;
  body?: PostmanBody;
}

export interface PostmanResponseExample {
  code?: number;
}

export interface PostmanItem {
  name?: string;
  item?: PostmanItem[];
  request?: PostmanRequest;
  response?: PostmanResponseExample[];
}

export interface PostmanCollection {
  info?: { schema?: string; name?: string };
  item?: PostmanItem[];
}
