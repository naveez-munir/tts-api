import {
  PipeTransform,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import type { ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown): unknown {
    try {
      return this.schema.parse(value);
    } catch (error: any) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.issues[0].message,
          details: error.issues,
        },
      });
    }
  }
}

