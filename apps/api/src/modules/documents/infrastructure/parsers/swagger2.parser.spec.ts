import { Swagger2Parser } from "./swagger2.parser";
import { SpecValidationError } from "../../application/ports/spec-parser";

const VALID_DOC = {
  swagger: "2.0",
  info: { title: "Acme API", version: "1.0.0" },
  paths: {
    "/users/{id}": {
      parameters: [{ name: "id", in: "path", required: true, type: "string" }],
      get: {
        operationId: "getUser",
        parameters: [{ name: "id", in: "path", required: true, type: "string", "x-example": "42" }],
        responses: {
          "200": { description: "OK", schema: { type: "object", example: { id: "42" } } },
        },
      },
      post: {
        parameters: [
          {
            name: "body",
            in: "body",
            schema: { type: "object", example: { name: "Ada" } },
          },
        ],
        responses: { "201": { description: "Created" } },
      },
    },
  },
};

describe("Swagger2Parser", () => {
  const parser = new Swagger2Parser();

  it("parses a valid document into normalised endpoints", async () => {
    const spec = await parser.parse(VALID_DOC);

    expect(spec.specVersion).toBe("2.0");
    expect(spec.endpoints).toHaveLength(2);

    const get = spec.endpoints.find((e) => e.method === "GET");
    expect(get?.operationId).toBe("getUser");
    expect(get?.expectedStatuses).toEqual([200]);
    expect(get?.sampleParams).toEqual({ id: "42" });
    expect(get?.responseSchema).toEqual({ type: "object", example: { id: "42" } });

    const post = spec.endpoints.find((e) => e.method === "POST");
    expect(post?.sampleBody).toEqual({ name: "Ada" });
  });

  it("rejects a document with an external $ref", async () => {
    const withExternalRef = { swagger: "2.0", paths: { "/users": { $ref: "./other.yaml#/paths/~1users" } } };

    await expect(parser.parse(withExternalRef)).rejects.toThrow(SpecValidationError);
  });

  it("wraps a swagger-parser validation failure as a SpecValidationError", async () => {
    const invalidDoc = { swagger: "2.0" }; // no `info`, no `paths`

    await expect(parser.parse(invalidDoc)).rejects.toThrow(SpecValidationError);
  });
});
