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

  /**
   * Anonymize IP address by masking the last octet (IPv4) or last 80 bits (IPv6).
   */
  private anonymizeIp(ip: string | undefined): string {
    if (!ip) return "unknown";
    // IPv4: mask last octet
    if (ip.includes(".") && !ip.includes(":")) {
      return ip.replace(/\.\d+$/, ".xxx");
    }
    // IPv6: mask last 5 groups
    const parts = ip.split(":");
    if (parts.length > 3) {
      return parts.slice(0, 3).join(":") + ":x:x:x:x:x";
    }
    return "unknown";
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const { method, url, ip } = request;
    const maskedIp = this.anonymizeIp(ip);
    const userId = (request as Request & { user?: { id: string } }).user?.id;

    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = ctx.getResponse();
          const statusCode = response.statusCode;
          const responseTime = Date.now() - now;

          this.logger.log(
            `[${method}] ${url} ${statusCode} ${responseTime}ms - ${maskedIp} ${userId ? `user:${userId}` : "anonymous"}`,
          );
        },
        error: (error) => {
          const responseTime = Date.now() - now;

          this.logger.error(
            `[${method}] ${url} ERROR ${responseTime}ms - ${maskedIp} ${userId ? `user:${userId}` : "anonymous"} - ${error.message}`,
          );
        },
      }),
    );
  }
}
