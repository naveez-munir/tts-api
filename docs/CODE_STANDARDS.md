# Code Consistency Standards

## TypeScript Standards

### Shared Types Location

- Create `packages/shared-types` directory in monorepo
- Export all shared types, interfaces, enums, and Zod schemas
- Both frontend and backend import from this shared location
- Keep frontend-specific and backend-specific types in their respective projects

### Type Definitions

- Enable `strict: true` in tsconfig.json for both projects
- Use `interface` for object shapes that may be extended, `type` for unions/intersections
- Avoid `any` type - use `unknown` and type guards if type is truly unknown
- Use `enum` for fixed sets of values (e.g., UserRole, BookingStatus, VehicleType)
- Define Zod schemas alongside TypeScript types for runtime validation
- Use `z.infer<typeof schema>` to derive TypeScript types from Zod schemas

### Naming Conventions

- **Types/Interfaces**: PascalCase (e.g., `UserProfile`, `BookingRequest`)
- **Enums**: PascalCase for enum name, SCREAMING_SNAKE_CASE for values (e.g., `enum UserRole { CUSTOMER = 'CUSTOMER' }`)
- **Variables/Functions**: camelCase (e.g., `calculateQuote`, `bookingData`)
- **Constants**: SCREAMING_SNAKE_CASE (e.g., `MAX_PASSENGERS`, `DEFAULT_BIDDING_WINDOW`)
- **React Components**: PascalCase (e.g., `BookingForm`, `VehicleCard`)

### File Naming Conventions

- ✅ **React Component Files**: PascalCase (e.g., `BookingForm.tsx`, `CtaSection.tsx`, `Header.tsx`)
- ✅ **Route Folders** (Next.js app directory): kebab-case (e.g., `app/operators/`, `app/about/`)
- ✅ **Utility/Helper Files**: camelCase (e.g., `utils.ts`, `constants.ts`)
- ❌ **Avoid**: kebab-case for component files (e.g., `booking-form.tsx` ❌), camelCase for components (e.g., `bookingForm.tsx` ❌), snake_case (e.g., `booking_form.tsx` ❌)

**Rationale**: PascalCase for component files ensures consistency between the component name and the filename, making imports clearer and preventing case-sensitivity issues across different operating systems.

---

## NestJS Backend Standards

### TypeScript Configuration

**Required tsconfig.json settings**:

```json
{
  "compilerOptions": {
    "strict": true,                          // Enable strict mode
    "noImplicitAny": true,                   // Disallow implicit any
    "strictNullChecks": true,                // Strict null checks
    "strictFunctionTypes": true,             // Strict function types
    "strictBindCallApply": true,             // Strict bind/call/apply
    "strictPropertyInitialization": true,   // Strict property initialization
    "noImplicitThis": true,                  // No implicit this
    "alwaysStrict": true,                    // Always strict mode
    "noUnusedLocals": true,                  // Error on unused locals
    "noUnusedParameters": true,              // Error on unused parameters
    "noImplicitReturns": true,               // Error on implicit returns
    "noFallthroughCasesInSwitch": true,      // Error on fallthrough cases
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "paths": {
      "@/*": ["src/*"]                       // Path alias for imports
    },
    "target": "ES2023",
    "module": "commonjs",
    "lib": ["ES2023"],
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
```

### NestJS Module Structure

**Feature Module Organization**:

```
src/modules/
├── auth/
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── auth.module.ts
│   ├── dto/
│   │   ├── register.dto.ts
│   │   ├── login.dto.ts
│   │   └── auth-response.dto.ts
│   ├── strategies/
│   │   ├── jwt.strategy.ts
│   │   └── local.strategy.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── local-auth.guard.ts
│   └── auth.service.spec.ts
├── users/
│   ├── users.controller.ts
│   ├── users.service.ts
│   ├── users.module.ts
│   ├── dto/
│   │   ├── create-user.dto.ts
│   │   ├── update-user.dto.ts
│   │   └── user-response.dto.ts
│   └── users.service.spec.ts
├── bookings/
├── jobs/
├── bids/
├── operators/
├── payments/
└── notifications/
├── common/
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   ├── roles.guard.ts
│   │   └── optional-jwt.guard.ts
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   ├── roles.decorator.ts
│   │   └── public.decorator.ts
│   ├── interceptors/
│   │   ├── response.interceptor.ts
│   │   └── logging.interceptor.ts
│   ├── pipes/
│   │   ├── zod-validation.pipe.ts
│   │   └── parse-uuid.pipe.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   └── types/
│       └── index.ts
├── database/
│   ├── prisma.service.ts
│   └── migrations/
├── config/
│   ├── database.config.ts
│   ├── jwt.config.ts
│   └── app.config.ts
└── app.module.ts
```

---

## NestJS Coding Standards

### Controllers

```typescript
// ✅ CORRECT
import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }
}
```

### Services

```typescript
// ✅ CORRECT
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    return this.prisma.user.create({
      data: createUserDto,
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }
}
```

### DTOs (Data Transfer Objects)

```typescript
// ✅ CORRECT - Use Zod for validation
import { z } from 'zod';

export const CreateUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[a-z]/, 'Must contain lowercase letter')
    .regex(/[0-9]/, 'Must contain number'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  role: z.enum(['CUSTOMER', 'OPERATOR', 'ADMIN']),
});

export type CreateUserDto = z.infer<typeof CreateUserSchema>;
```

### Guards

```typescript
// ✅ CORRECT
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

### Decorators

```typescript
// ✅ CORRECT
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

### Interceptors

```typescript
// ✅ CORRECT
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
```

### Exception Filters

```typescript
// ✅ CORRECT
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.getResponse() as string;
    }

    response.status(status).json({
      success: false,
      error: {
        code: 'ERROR',
        message,
      },
      timestamp: new Date().toISOString(),
    });
  }
}
```

### Validation Pipe

```typescript
// ✅ CORRECT - Zod Validation Pipe
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    try {
      return this.schema.parse(value);
    } catch (error: any) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: error.errors,
        },
      });
    }
  }
}
```

---

## NestJS Best Practices

### 1. Dependency Injection
- Always use constructor injection
- Use `readonly` for injected dependencies
- Avoid circular dependencies

### 2. Error Handling
- Use NestJS built-in exceptions (BadRequestException, NotFoundException, etc.)
- Create custom exceptions for domain-specific errors
- Use exception filters for global error handling

### 3. Logging
- Use NestJS Logger service
- Log at appropriate levels (debug, log, warn, error)
- Never log sensitive data (passwords, tokens, credit cards)

### 4. Testing
- Write unit tests for services
- Write integration tests for controllers
- Use `@nestjs/testing` module
- Mock external dependencies

### 5. Modules
- Keep modules focused and single-responsibility
- Export only what's needed
- Use feature modules for each domain
- Import shared modules in feature modules

### 6. Async/Await
- Always use async/await for async operations
- Avoid callback hell
- Handle errors with try-catch

---

## Database Integration (Prisma)

### Prisma Service

```typescript
// ✅ CORRECT - Prisma Service
import { Injectable, OnModuleInit, INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  async enableShutdownHooks(app: INestApplication) {
    this.$on('beforeExit', async () => {
      await app.close();
    });
  }
}
```

### Usage in Services

```typescript
// ✅ CORRECT
@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        operatorProfile: true,
      },
    });
  }
}
```

---

## Database Field Naming

- Use snake_case for all PostgreSQL column names (e.g., `first_name`, `created_at`, `booking_reference`)
- Prisma will auto-map to camelCase in generated client (e.g., `firstName`, `createdAt`, `bookingReference`)
- Boolean fields: prefix with `is_` or `has_` (e.g., `is_active`, `has_wheelchair_access`)
- Timestamp fields: suffix with `_at` (e.g., `created_at`, `updated_at`, `completed_at`)
- Foreign keys: suffix with `_id` (e.g., `user_id`, `operator_id`, `booking_id`)

---

## API Naming Conventions

### Endpoint Structure (RESTful)

- Use kebab-case for multi-word resources: `/api/transport-companies`, `/api/pricing-rules`
- Resource-based URLs: `/api/bookings`, `/api/jobs`, `/api/bids`
- Use HTTP methods correctly: GET (read), POST (create), PUT/PATCH (update), DELETE (delete)
- Nested resources: `/api/jobs/:jobId/bids`, `/api/bookings/:bookingId/transactions`
- Actions that don't fit REST: POST `/api/jobs/:jobId/assign`, POST `/api/bookings/:bookingId/refund`

### Examples

- `GET /api/bookings` - List all bookings (with pagination, filters)
- `POST /api/bookings` - Create new booking
- `GET /api/bookings/:id` - Get booking details
- `PATCH /api/bookings/:id` - Update booking
- `POST /api/jobs/:jobId/bids` - Submit bid on job
- `GET /api/operators/dashboard` - Get operator dashboard data

---

## API Response Format

### Success Response

```typescript
{
  success: true,
  data: { /* response payload */ },
  meta: { /* pagination, timestamps, etc. */ }
}
```

### Error Response

```typescript
{
  success: false,
  error: {
    code: 'VALIDATION_ERROR', // machine-readable error code
    message: 'Invalid booking details', // human-readable message
    details: [ /* array of specific validation errors */ ]
  }
}
```

### HTTP Status Codes

- 200: Success (GET, PATCH, PUT)
- 201: Created (POST)
- 204: No Content (DELETE)
- 400: Bad Request (validation errors)
- 401: Unauthorized (not authenticated)
- 403: Forbidden (authenticated but not authorized)
- 404: Not Found
- 409: Conflict (e.g., duplicate booking reference)
- 500: Internal Server Error

---

## Code Quality Standards

- Use ESLint with TypeScript rules for both projects
- Use Prettier for consistent code formatting
- Write JSDoc comments for complex functions and public APIs
- Separate business logic from presentation (services pattern in backend, custom hooks in frontend)
- Use custom hooks for reusable logic in React components
- Keep components small and focused (single responsibility)
- Prefer composition over prop drilling (use Context API for deeply nested state)
