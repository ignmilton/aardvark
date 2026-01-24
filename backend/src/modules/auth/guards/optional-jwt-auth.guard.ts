import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Optional JWT authentication guard.
 * Populates req.user if a valid JWT is present, but does NOT reject
 * unauthenticated requests (no token). Use this when behavior differs
 * between authenticated and unauthenticated users.
 *
 * IMPORTANT: If a token IS present but is invalid/blacklisted, this
 * guard WILL reject the request (unlike missing tokens which are allowed).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    // If there's an explicit error (blacklisted token, malformed token with
    // valid signature, etc.), reject the request
    if (err) {
      throw err instanceof UnauthorizedException
        ? err
        : new UnauthorizedException(err.message || 'Authentication failed');
    }

    // If no user but also no error, token was simply absent - allow as guest
    return user || null;
  }
}
