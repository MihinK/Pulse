import { Organization } from "../../identity/domain/organization.entity";
import { User } from "../../identity/domain/user.entity";

/**
 * MikroORM's `@ManyToOne`/`onUpdate` decorators take a function rather than the value directly
 * (needed for circular-reference cases elsewhere in the codebase) — these targets are reused
 * across several entities in this module, so they're defined once here instead of as a fresh
 * inline closure per usage site.
 */
export const organizationRef = (): typeof Organization => Organization;
export const userRef = (): typeof User => User;
export const touchUpdatedAt = (): Date => new Date();
