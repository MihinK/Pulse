import { PostmanV21Parser } from "./postman-v21.parser";
import { SpecValidationError } from "../../application/ports/spec-parser";

const VALID_COLLECTION = {
  info: {
    name: "Acme API",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  item: [
    {
      name: "Users",
      item: [
        {
          name: "Get user",
          request: {
            method: "GET",
            url: { raw: "https://api.acme.test/users/42?verbose=true", path: ["users", "42"], query: [{ key: "verbose", value: "true" }] },
          },
          response: [{ code: 200 }, { code: 200 }, { code: 404 }],
        },
        {
          name: "Create user",
          request: {
            method: "POST",
            url: { path: ["users"] },
            body: { mode: "raw", raw: JSON.stringify({ name: "Ada" }) },
          },
          response: [],
        },
      ],
    },
  ],
};

describe("PostmanV21Parser", () => {
  const parser = new PostmanV21Parser();

  it("parses a valid collection, walking nested folders into a flat endpoint list", async () => {
    const spec = await parser.parse(VALID_COLLECTION);

    expect(spec.specVersion).toBe("2.1.0");
    expect(spec.endpoints).toHaveLength(2);

    const get = spec.endpoints.find((e) => e.method === "GET");
    expect(get?.path).toBe("/users/42");
    expect(get?.operationId).toBe("Get user");
    expect(get?.sampleParams).toEqual({ verbose: "true" });
    expect(get?.expectedStatuses).toEqual([200, 404]);

    const post = spec.endpoints.find((e) => e.method === "POST");
    expect(post?.path).toBe("/users");
    expect(post?.sampleBody).toEqual({ name: "Ada" });
  });

  it("rejects a document missing the required info.schema field", async () => {
    await expect(parser.parse({ info: {}, item: [] })).rejects.toThrow(SpecValidationError);
  });

  it("rejects a document that isn't an object at all", async () => {
    await expect(parser.parse("not a collection")).rejects.toThrow(SpecValidationError);
  });

  it("defaults to GET and ignores an unparsable request body", async () => {
    const spec = await parser.parse({
      info: { schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
      item: [{ name: "Weird", request: { url: "https://api.acme.test/ping", body: { mode: "raw", raw: "not json" } } }],
    });

    expect(spec.endpoints[0]?.method).toBe("GET");
    expect(spec.endpoints[0]?.path).toBe("/ping");
    expect(spec.endpoints[0]?.sampleBody).toBeUndefined();
  });

  it("falls back to a literal path when the raw URL isn't a valid absolute URL", async () => {
    const spec = await parser.parse({
      info: { schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
      item: [{ name: "Relative", request: { url: "/relative/path?x=1" } }],
    });

    expect(spec.endpoints[0]?.path).toBe("/relative/path");
  });

  it("skips items with neither a nested item list nor a request", async () => {
    const spec = await parser.parse({
      info: { schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
      item: [{ name: "Folder marker only" }],
    });

    expect(spec.endpoints).toEqual([]);
  });
});
