import type { Request } from "express";
import type { Principal } from "./principal";

/** An Express request after `JwtAuthGuard` has (possibly) attached a decoded principal. */
export interface AuthenticatedRequest extends Request {
  principal?: Principal;
}
