import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { EntityManager } from "@mikro-orm/postgresql";
import { from, lastValueFrom, Observable } from "rxjs";
import { Role } from "../../modules/identity/domain/role.enum";
import type { AuthenticatedRequest } from "./authenticated-request";

/**
 * Applied per-controller (`@UseInterceptors(TenancyInterceptor)`) on every controller that
 * touches a tenant table. Opens one Postgres transaction for the whole request and sets the two
 * session variables the RLS policies (ADR-003, the RLS migration) read:
 *
 * - `app.current_org_id` — the authenticated principal's organisation.
 * - `app.bypass_rls` — true for the Platform Owner (who legitimately spans every org) and for
 *   unauthenticated `@Public()` routes (login-by-email and invitation-accept, which must find a
 *   row before an org is known). This keeps the bypass to exactly those reviewed call sites,
 *   never a general superuser mode.
 *
 * `em.transactional()` forks the EntityManager and rebinds MikroORM's ambient RequestContext to
 * that fork for the callback's duration, so every repository call the controller/service makes
 * during this request runs inside the same transaction — no extra wiring needed downstream.
 */
@Injectable()
export class TenancyInterceptor implements NestInterceptor {
  public constructor(private readonly em: EntityManager) {}

  public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const principal = request.principal;
    const bypassRls = !principal || principal.role === Role.PLATFORM_OWNER;
    const currentOrgId = principal?.organizationId ?? "";

    return from(
      this.em.transactional(async (em: EntityManager) => {
        // `em.getConnection()` alone returns the driver's pooled connection wrapper, not one
        // bound to this transaction — `SET LOCAL` on it would land on an unrelated connection
        // and never affect the queries this request actually runs. Passing `em.getTransactionContext()`
        // as the 4th arg is what binds the call to the transaction `em.transactional()` just opened.
        const connection = em.getConnection("write");
        // MikroORM's own `Transaction<T = any> = T` type alias means getTransactionContext()'s
        // return type is `any` by design (transaction handles are opaque, driver-specific
        // objects) — not something a local type annotation can narrow away.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const ctx = em.getTransactionContext();
        await connection.execute(
          "select set_config('app.bypass_rls', ?, true)",
          [String(bypassRls)],
          "all",
          ctx,
        );
        await connection.execute(
          "select set_config('app.current_org_id', ?, true)",
          [currentOrgId],
          "all",
          ctx,
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- same `any` origin as above
        return lastValueFrom(next.handle());
      }),
    );
  }
}
