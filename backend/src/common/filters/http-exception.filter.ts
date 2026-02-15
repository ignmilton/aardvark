import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

/**
 * Global exception filter that catches all HTTP exceptions
 * and formats them into a consistent error response format.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;
    let errorCode: string;
    let details: Record<string, unknown> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === "string") {
        message = exceptionResponse;
        errorCode = this.getErrorCode(status);
      } else if (typeof exceptionResponse === "object") {
        const responseObj = exceptionResponse as Record<string, unknown>;
        message =
          (responseObj.message as string) ||
          (responseObj.error as string) ||
          "An error occurred";

        // Handle validation errors (array of messages)
        if (Array.isArray(responseObj.message)) {
          message = "Validation failed";
          details = { errors: responseObj.message };
        }

        errorCode = (responseObj.code as string) || this.getErrorCode(status);
      } else {
        message = "An error occurred";
        errorCode = this.getErrorCode(status);
      }
    } else if (exception instanceof Error) {
      // Handle non-HTTP exceptions
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = "Internal server error";
      errorCode = "E9001";

      // Log the actual error for debugging
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
      );
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = "Internal server error";
      errorCode = "E9001";
    }

    const errorResponse = {
      success: false,
      error: {
        code: errorCode,
        message,
        ...(details && { details }),
        // Include stack trace only in development
        ...(process.env.NODE_ENV !== "production" &&
          exception instanceof Error && { stack: exception.stack }),
      },
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
    };

    // Log error details
    this.logger.warn(
      `[${request.method}] ${request.url} - ${status} - ${message}`,
    );

    response.status(status).json(errorResponse);
  }

  /**
   * Map HTTP status codes to application error codes
   */
  private getErrorCode(status: number): string {
    const errorCodeMap: Record<number, string> = {
      400: "E3001", // Bad Request
      401: "E1001", // Unauthorized
      403: "E2001", // Forbidden
      404: "E4001", // Not Found
      409: "E3003", // Conflict (Duplicate)
      422: "E3001", // Unprocessable Entity
      429: "E5001", // Too Many Requests
      500: "E9001", // Internal Server Error
      502: "E9003", // Bad Gateway
      503: "E9003", // Service Unavailable
    };

    return errorCodeMap[status] || "E9001";
  }
}
