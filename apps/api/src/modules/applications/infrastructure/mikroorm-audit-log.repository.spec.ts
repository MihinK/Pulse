import type { EntityRepository } from "@mikro-orm/postgresql";
import { MikroOrmAuditLogRepository } from "./mikroorm-audit-log.repository";
import { Organization } from "../../identity/domain/organization.entity";
import { User } from "../../identity/domain/user.entity";
import { Role } from "../../identity/domain/role.enum";
import { AuditLog } from "../domain/audit-log.entity";

function build() {
  const persisted: AuditLog[] = [];
  const flushCount = { value: 0 };
  const em = {
    persist: (log: AuditLog): void => {
      persisted.push(log);
    },
    flush: async (): Promise<void> => {
      flushCount.value += 1;
    },
  };
  const underlying = {
    getEntityManager: () => em,
  } as unknown as EntityRepository<AuditLog>;
  return { repository: new MikroOrmAuditLogRepository(underlying), persisted, flushCount };
}

describe("MikroOrmAuditLogRepository", () => {
  const org = new Organization("Acme", "acme", "UTC");
  const admin = new User("admin@acme.test", "hash", Role.ADMIN, org);
  const log = new AuditLog(org, admin, "application.created", "Application", "app-1");

  it("persists and flushes on save", async () => {
    const { repository, persisted, flushCount } = build();

    await repository.save(log);

    expect(persisted).toEqual([log]);
    expect(flushCount.value).toBe(1);
  });
});
