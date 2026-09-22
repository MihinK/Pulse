/**
 * Injection tokens for the health module's interfaces. NestJS needs a
 * runtime token (not just a TypeScript interface, which disappears after
 * compilation) to resolve dependencies through its container.
 */
export const CLOCK = Symbol("CLOCK");
export const DEPENDENCY_CHECKS = Symbol("DEPENDENCY_CHECKS");
