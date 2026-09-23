import { OpenApi3Parser } from "./openapi3.parser";
import { SpecValidationError } from "../../application/ports/spec-parser";

const VALID_DOC = {
  openapi: "3.0.1",
  info: { title: "Acme API", version: "1.0.0" },
  paths: {
    "/users/{id}": {
      get: {
        operationId: "getUser",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" }, example: "42" },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { type: "object", example: { id: "42", name: "Ada" } },
              },
            },
          },
          "404": { description: "Not found" },
        },
      },
      post: {
        requestBody: {
          content: {
            "application/json": {
              schema: { type: "object" },
              example: { name: "Ada" },
            },
          },
        },
        responses: { "201": { description: "Created" } },
      },
    },
  },
};

describe("OpenApi3Parser", () => {
  const parser = new OpenApi3Parser();

  it("parses a valid document into normalised endpoints", async () => {
    const spec = await parser.parse(VALID_DOC);

    expect(spec.specVersion).toBe("3.0.1");
    expect(spec.endpoints).toHaveLength(2);

    const get = spec.endpoints.find((e) => e.method === "GET");
    expect(get?.path).toBe("/users/{id}");
    expect(get?.operationId).toBe("getUser");
    expect(get?.expectedStatuses).toEqual([200]);
    expect(get?.sampleParams).toEqual({ id: "42" });
    expect(get?.responseSchema).toEqual({ type: "object", example: { id: "42", name: "Ada" } });

    const post = spec.endpoints.find((e) => e.method === "POST");
    expect(post?.expectedStatuses).toEqual([201]);
    expect(post?.sampleBody).toEqual({ name: "Ada" });
  });

  it("rejects a document with an external $ref before even attempting to dereference it", async () => {
    const withExternalRef = {
      openapi: "3.0.1",
      paths: { "/users": { $ref: "./other-file.yaml#/paths/~1users" } },
    };

    await expect(parser.parse(withExternalRef)).rejects.toThrow(SpecValidationError);
  });

  it("wraps a swagger-parser validation failure as a SpecValidationError", async () => {
    const invalidDoc = { openapi: "3.0.1" }; // no `paths`, no `info` — fails spec validation

    await expect(parser.parse(invalidDoc)).rejects.toThrow(SpecValidationError);
  });

  it("returns an empty endpoint list for a document with no paths", async () => {
    const emptyDoc = { openapi: "3.0.1", info: { title: "Empty", version: "1.0.0" }, paths: {} };

    const spec = await parser.parse(emptyDoc);

    expect(spec.endpoints).toEqual([]);
  });
});
