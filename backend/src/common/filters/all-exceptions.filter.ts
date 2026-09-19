import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { DomainRuleException } from '../exceptions/domain-rule.exception';

interface ErrorBody {
  statusCode: number;
  error: string;
  code?: string;
  details?: Record<string, unknown>;
  message: string | string[];
  correlationId?: string;
  path: string;
  timestamp: string;
}

/** Normaliza toda respuesta de error y evita filtrar detalles internos. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { correlationId?: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Error interno del servidor.';
    let error = 'Internal Server Error';
    let code: string | undefined;
    let details: Record<string, unknown> | undefined;

    if (exception instanceof DomainRuleException) {
      status = exception.getStatus();
      code = exception.code;
      error = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        message = payload;
        error = exception.name;
      } else if (payload && typeof payload === 'object') {
        const record = payload as Record<string, unknown>;
        message = (record.message as string | string[]) ?? exception.message;
        error = (record.error as string) ?? exception.name;
        if (typeof record.code === 'string') code = record.code;
        if (record.details && typeof record.details === 'object') {
          details = record.details as Record<string, unknown>;
        }
      }
    } else if (this.isUniqueViolation(exception)) {
      status = HttpStatus.CONFLICT;
      error = 'Conflict';
      message = 'Ya existe un registro con ese identificador unico.';
    } else if (this.isForeignKeyViolation(exception)) {
      status = HttpStatus.BAD_REQUEST;
      error = 'Bad Request';
      message = 'La operacion referencia una entidad inexistente o en uso.';
    }

    if (status >= 500) {
      this.logger.error(
        `[${request.correlationId ?? '-'}] ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorBody = {
      statusCode: status,
      error,
      ...(code ? { code } : {}),
      ...(details ? { details } : {}),
      message,
      correlationId: request.correlationId,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(body);
  }

  private isUniqueViolation(exception: unknown): boolean {
    return this.pgCode(exception) === '23505';
  }

  private isForeignKeyViolation(exception: unknown): boolean {
    return this.pgCode(exception) === '23503';
  }

  private pgCode(exception: unknown): string | undefined {
    if (exception && typeof exception === 'object' && 'code' in exception) {
      const code = (exception as { code?: unknown }).code;
      return typeof code === 'string' ? code : undefined;
    }
    return undefined;
  }
}
