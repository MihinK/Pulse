import { Entity, PrimaryKey, Property, Enum, ManyToOne, Index } from "@mikro-orm/core";
import { v7 as uuidv7 } from "uuid";
import type { Clock } from "@pulse/shared";
import { Role } from "./role.enum";
import { Organization } from "./organization.entity";
import { User } from "./user.entity";

export class InvitationAlreadyAcceptedError extends Error {
  public constructor() {
    super("Invitation has already been accepted");
  }
}

export class InvitationExpiredError extends Error {
  public constructor() {
    super("Invitation has expired");
  }
}

@Entity({ tableName: "invitations" })
export class Invitation {
  @PrimaryKey({ type: "uuid" })
  public readonly id: string = uuidv7();

  @Index()
  @ManyToOne(() => Organization, { fieldName: "organization_id" })
  public readonly organization: Organization;

  @Property()
  public readonly email: string;

  @Enum(() => Role)
  public readonly role: Role;

  @Property({ fieldName: "token_hash", unique: true })
  public readonly tokenHash: string;

  @Property({ fieldName: "expires_at" })
  public readonly expiresAt: Date;

  @Property({ fieldName: "accepted_at", nullable: true })
  public acceptedAt?: Date;

  @ManyToOne(() => User, { fieldName: "invited_by" })
  public readonly invitedBy: User;

  @Property({ fieldName: "created_at" })
  public readonly createdAt: Date = new Date();

  @Property({ fieldName: "updated_at", onUpdate: () => new Date() })
  public updatedAt: Date = new Date();

  @Property({ version: true })
  public readonly version: number = 1;

  public constructor(
    organization: Organization,
    email: string,
    role: Role,
    tokenHash: string,
    expiresAt: Date,
    invitedBy: User,
  ) {
    this.organization = organization;
    this.email = email;
    this.role = role;
    this.tokenHash = tokenHash;
    this.expiresAt = expiresAt;
    this.invitedBy = invitedBy;
  }

  public isAccepted(): boolean {
    // MikroORM hydrates a NULL "accepted_at" column as `null`, not `undefined` — `!= null` (loose)
    // catches both that case and a freshly constructed, never-persisted invitation.
    return this.acceptedAt != null;
  }

  public isExpired(clock: Clock): boolean {
    return clock.now().getTime() >= this.expiresAt.getTime();
  }

  public accept(clock: Clock): void {
    if (this.isAccepted()) {
      throw new InvitationAlreadyAcceptedError();
    }
    if (this.isExpired(clock)) {
      throw new InvitationExpiredError();
    }
    this.acceptedAt = clock.now();
  }
}
