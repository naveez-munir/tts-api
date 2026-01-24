import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorResponse: any = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // Handle custom error objects (from ZodValidationPipe, etc.)
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as any;

        // If it's already our format with success/error
        if (resp.success === false && resp.error) {
          errorResponse = resp;
        }
        // If it has message array (class-validator style)
        else if (Array.isArray(resp.message)) {
          errorResponse = {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Validation failed',
              details: resp.message,
            },
          };
        }
        // If it has a message string
        else if (resp.message) {
          errorResponse = {
            success: false,
            error: {
              code: this.getErrorCode(status),
              message: resp.message,
            },
          };
        }
      }
      // Handle string responses
      else if (typeof exceptionResponse === 'string') {
        errorResponse = {
          success: false,
          error: {
            code: this.getErrorCode(status),
            message: exceptionResponse,
          },
        };
      }
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
      errorResponse = {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      };
    }

    response.status(status).json(errorResponse);
  }

  private getErrorCode(status: number): string {
    switch (status) {
      case 400:
        return 'BAD_REQUEST';
      case 401:
        return 'UNAUTHORIZED';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 409:
        return 'CONFLICT';
      case 422:
        return 'UNPROCESSABLE_ENTITY';
      case 429:
        return 'TOO_MANY_REQUESTS';
      default:
        return 'INTERNAL_ERROR';
    }
  }
}

