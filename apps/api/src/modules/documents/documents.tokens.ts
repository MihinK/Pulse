/**
 * Injection tokens for the documents module's interfaces, following the pattern established by
 * `modules/applications/applications.tokens.ts`. `OUTBOX_REPOSITORY` and `NETWORK_POLICY` are
 * NOT redeclared here — this module injects the tokens `ApplicationsModule` already exports,
 * reusing the same provider rather than standing up a parallel one.
 */
export const API_DOCUMENT_REPOSITORY = Symbol("API_DOCUMENT_REPOSITORY");
export const ENDPOINT_REPOSITORY = Symbol("ENDPOINT_REPOSITORY");
export const SPEC_FORMAT_DETECTOR = Symbol("SPEC_FORMAT_DETECTOR");
export const OBJECT_STORAGE = Symbol("OBJECT_STORAGE");
export const CONTENT_FETCHER = Symbol("CONTENT_FETCHER");
export const QUEUE = Symbol("DOCUMENTS_QUEUE");

/** Upload size limit (technical plan section 8's threat table: "Malicious spec files: 10 MB
 * limit"), enforced both for multipart uploads and URL-import downloads. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
