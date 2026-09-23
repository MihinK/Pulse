/**
 * Sprint 4 gave the outbox a second producer/consumer pair (`documents`' `document.uploaded`),
 * which is why `OutboxRepository.findUnprocessed` now requires a `kind` — each module's relay
 * only ever sees its own rows, so two relays polling the same table can never race over the same
 * row or misroute it to the wrong queue. See `OutboxRelay`'s class comment.
 */
export const RUN_QUEUED_KIND = "run.queued";
