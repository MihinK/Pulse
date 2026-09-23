/** Same shape as `applications/application/ports/queue.ts` — kept as its own port rather than a
 * shared one so each module's application layer only depends on its own module boundary. */
export interface Queue {
  enqueue(kind: string, payload: Record<string, unknown>): Promise<void>;
}
