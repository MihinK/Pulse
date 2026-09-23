/**
 * Parsing happens in the worker, not the request handler (technical plan section 8's threat
 * table: "parsing in the worker with a time limit") — `PENDING` is what the upload endpoint
 * returns immediately; the frontend polls until `READY`/`FAILED`, the same way `/runs/:id` polls
 * a `CheckRun`.
 */
export enum DocumentStatus {
  PENDING = "PENDING",
  READY = "READY",
  FAILED = "FAILED",
}
