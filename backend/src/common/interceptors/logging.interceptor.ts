import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { Request } from "express";

/**
 * Logging interceptor that logs request details and response times
 * for monitoring and debugging purposes.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const { method, url, ip } = request;
    const userAgent = request.get("user-agent") || "";
    const userId = (request as Request & { user?: { id: string } }).user?.id;

    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = ctx.getResponse();
          const statusCode = response.statusCode;
          const responseTime = Date.now() - now;

          this.logger.log(
            `[${method}] ${url} ${statusCode} ${responseTime}ms - ${ip} ${userAgent} ${userId ? `user:${userId}` : "anonymous"}`,
          );
        },
        error: (error) => {
          const responseTime = Date.now() - now;

          this.logger.error(
            `[${method}] ${url} ERROR ${responseTime}ms - ${ip} ${userAgent} ${userId ? `user:${userId}` : "anonymous"} - ${error.message}`,
          );
        },
      }),
    );
  }
}
