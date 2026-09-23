/**
 * The normalised output every `SpecParser` produces, regardless of source format (technical plan
 * section 4.1: "Turn an uploaded file into a normalised `ParsedSpec`"). A plain value shape, not
 * a MikroORM entity — `DocumentService` turns each one into an `Endpoint` row.
 */
export interface ParsedEndpoint {
  method: string;
  path: string;
  operationId?: string;
  expectedStatuses?: number[];
  responseSchema?: Record<string, unknown>;
  sampleParams?: Record<string, unknown>;
  sampleBody?: Record<string, unknown>;
}

export interface ParsedSpec {
  endpoints: ParsedEndpoint[];
  /** The spec's own declared version string (e.g. "3.0.1", "2.0", "2.1.0") — distinct from
   * `ApiDocument.versionNo`, Pulse's own per-application upload counter. */
  specVersion?: string;
}
