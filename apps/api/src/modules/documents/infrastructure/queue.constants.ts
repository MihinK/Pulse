/** Its own dedicated BullMQ queue (see `outbox-kinds.ts`'s header comment for why this can't
 * share `applications`' `check-runs` queue). */
export const DOCUMENT_PARSING_QUEUE = "document-parsing";
