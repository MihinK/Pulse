import { SetMetadata, type CustomDecorator } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/** Exempts a route from {@link JwtAuthGuard}. Used only for auth bootstrap endpoints. */
export const Public = (): CustomDecorator<string> => SetMetadata(IS_PUBLIC_KEY, true);
