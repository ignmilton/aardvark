import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Optional JWT authentication guard.
 * Populates req.user if a valid JWT is present, but does NOT reject
 * unauthenticated requests. Use this when behavior differs between
 * authenticated and unauthenticated users (e.g., guest access restrictions).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any) {
    // Don't throw on missing/invalid token - just return null
    return user || null;
  }
}
