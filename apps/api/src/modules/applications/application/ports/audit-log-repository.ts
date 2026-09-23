import type { AuditLog } from "../../domain/audit-log.entity";

export interface AuditLogRepository {
  save(entry: AuditLog): Promise<void>;
}
