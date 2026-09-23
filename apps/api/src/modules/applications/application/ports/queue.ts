/** The application layer depends on this, never on BullMQ directly (`BullMqQueue` implements it). */
export interface Queue {
  enqueue(kind: string, payload: Record<string, unknown>): Promise<void>;
}
