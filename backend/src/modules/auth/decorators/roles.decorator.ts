import { SetMetadata } from "@nestjs/common";
import { UserRole } from "@aardvark/shared";

export const ROLES_KEY = "roles";

/**
 * Decorator to specify required roles for a route.
 * Use with @Roles(UserRole.ADMIN, UserRole.MODERATOR)
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
