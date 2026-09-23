import type { ParsedSpec } from "../../domain/parsed-spec";

/** Thrown when a document fails validation (technical plan 4.4, step 2/3) — an external `$ref`,
 * a schema violation, or a structurally invalid document. Distinct from a thrown generic Error so
 * the worker can record a clean `failureReason` instead of a stack trace. */
export class SpecValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "SpecValidationError";
  }
}

/** Turn a safely-loaded document into a normalised `ParsedSpec` (technical plan 4.1). One
 * implementation per format — `OpenApi3Parser`, `Swagger2Parser`, `PostmanV21Parser`. */
export interface SpecParser {
  parse(document: unknown): Promise<ParsedSpec>;
}
