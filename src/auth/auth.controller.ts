import {
  Body,
  Controller,
  Post,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import { RegisterSchema } from './dto/register.dto.js';
import type { RegisterDto } from './dto/register.dto.js';
import { LoginSchema } from './dto/login.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { ResendService } from '../integrations/resend/resend.service.js';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly resendService: ResendService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 requests per 60 seconds
  async register(
    @Body(new ZodValidationPipe(RegisterSchema)) dto: RegisterDto,
  ) {
    try {
      const user = await this.usersService.create(dto);
      const { password: _, ...userWithoutPassword } = user;

      // Send welcome email (non-blocking - don't wait for email to complete)
      if (user.role === 'CUSTOMER') {
        this.resendService
          .sendWelcomeEmail(user.email, {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
          })
          .catch((error) => {
            this.logger.error(
              `Failed to send welcome email to ${user.email}`,
              error,
            );
          });
      }

      return {
        success: true,
        data: userWithoutPassword,
        message: 'User registered successfully',
      };
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new BadRequestException('Email already exists');
      }
      throw error;
    }
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per 60 seconds
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) dto: LoginDto,
  ) {
    const user = await this.authService.validateUser(dto.email, dto.password);
    if (!user) {
      throw new BadRequestException('Invalid email or password');
    }

    const result = await this.authService.login({
      ...user,
      password: '', // Placeholder since we don't have it
    } as any);

    return {
      success: true,
      data: result,
    };
  }
}
