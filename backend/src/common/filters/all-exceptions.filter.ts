import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Every error the API returns goes through here, so the shape of an error
 * response is always the same regardless of which module threw it - the
 * frontend only ever has to handle one error format.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const rawMessage: unknown =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    const message = this.extractMessage(rawMessage);

    // Log full detail server-side; never leak internals in the response itself.
    this.logger.error(
      `${request.method} ${request.url} -> ${status}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    response.status(status).json({
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      message,
    });
  }

  private extractMessage(raw: unknown): string | string[] {
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'object' && raw !== null && 'message' in raw) {
      const msg = raw.message;
      if (typeof msg === 'string' || Array.isArray(msg)) return msg;
    }
    return 'Internal server error';
  }
}
