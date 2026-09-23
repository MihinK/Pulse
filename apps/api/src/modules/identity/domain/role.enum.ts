/**
 * PLATFORM_OWNER has `organizationId = null` and can act across every organisation (creating
 * orgs, cross-org admin). ADMIN and VIEWER are always scoped to exactly one organisation.
 */
export enum Role {
  PLATFORM_OWNER = "PLATFORM_OWNER",
  ADMIN = "ADMIN",
  VIEWER = "VIEWER",
}
