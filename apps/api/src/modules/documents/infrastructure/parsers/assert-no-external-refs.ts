import { SpecValidationError } from "../../application/ports/spec-parser";

/**
 * `swagger-parser`'s `resolve.external: false` only *ignores* external `$ref`s rather than
 * rejecting them (they're left in the dereferenced document as literal `{ $ref: "..." }`
 * objects) — technical plan 8's "external `$ref` in Cloud" must actually be rejected, so this
 * walks the raw (pre-dereference) document looking for any `$ref` that isn't a same-document
 * JSON pointer (`#/...`). Shared by `OpenApi3Parser` and `Swagger2Parser`.
 */
export function assertNoExternalRefs(document: unknown): void {
  const seen = new Set<unknown>();

  function walk(node: unknown): void {
    if (node === null || typeof node !== "object" || seen.has(node)) {
      return;
    }
    seen.add(node);

    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }

    const obj = node as Record<string, unknown>;
    const ref = obj["$ref"];
    if (typeof ref === "string" && !ref.startsWith("#")) {
      throw new SpecValidationError(`External $ref is not allowed in Cloud edition: ${ref}`);
    }
    for (const value of Object.values(obj)) {
      walk(value);
    }
  }

  walk(document);
}
