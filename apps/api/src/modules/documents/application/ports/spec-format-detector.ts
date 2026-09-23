import type { DocumentFormat } from "../../domain/document-format.enum";

export interface DetectedFormat {
  format: DocumentFormat;
  /** The safely-loaded document (JSON or YAML) — handed to the matching `SpecParser` so the
   * content isn't parsed a second time. */
  parsed: unknown;
}

/** Decide which parser fits a file (technical plan 4.1). Returns `null`, not a guess, when no
 * format matches — the caller turns that into a 400, never silently picks one. */
export interface SpecFormatDetector {
  detect(content: Buffer): DetectedFormat | null;
}
