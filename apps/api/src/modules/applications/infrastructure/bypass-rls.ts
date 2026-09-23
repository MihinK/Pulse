import type { EntityManager } from "@mikro-orm/postgresql";

/**
 * Sets `app.bypass_rls` directly on a fresh transaction, the way `PulseOwnerSeeder` does — for
 * code that runs outside any HTTP request (a relay poller, a queue worker), so there is no
 * `TenancyInterceptor` to set it. See `TenancyInterceptor` for why the transaction context must
 * be passed explicitly to `execute()`.
 */
export async function runWithBypassRls<T>(
  em: EntityManager,
  callback: (em: EntityManager) => Promise<T>,
): Promise<T> {
  return em.transactional(async (forkedEm) => {
    await forkedEm
      .getConnection("write")
      .execute(
        "select set_config('app.bypass_rls', 'true', true)",
        [],
        "all",
        forkedEm.getTransactionContext(),
      );
    return callback(forkedEm);
  });
}
