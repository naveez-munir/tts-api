import {
  Body,
  Controller,
  Post,
  BadRequestException,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import { RegisterSchema } from './dto/register.dto.js';
import type { RegisterDto } from './dto/register.dto.js';
import { LoginSchema } from './dto/login.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import { ForgotPasswordSchema } from './dto/forgot-password.dto.js';
import type { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordSchema } from './dto/reset-password.dto.js';
import type { ResetPasswordDto } from './dto/reset-password.dto.js';
import { SendVerificationOtpSchema } from './dto/send-verification-otp.dto.js';
import type { SendVerificationOtpDto } from './dto/send-verification-otp.dto.js';
import { VerifyEmailSchema } from './dto/verify-email.dto.js';
import type { VerifyEmailDto } from './dto/verify-email.dto.js';
import { ResendOtpSchema } from './dto/resend-otp.dto.js';
import type { ResendOtpDto } from './dto/resend-otp.dto.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { ResendService } from '../integrations/resend/resend.service.js';

@Controller('auth')
@UseGuards(ThrottlerGuard)
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

  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 requests per 60 seconds
  async forgotPassword(
    @Body(new ZodValidationPipe(ForgotPasswordSchema))
    dto: ForgotPasswordDto,
  ) {
    await this.authService.sendPasswordResetOTP(dto.email);
    return {
      success: true,
      message: 'Password reset OTP sent to your email',
    };
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per 60 seconds
  async resetPassword(
    @Body(new ZodValidationPipe(ResetPasswordSchema))
    dto: ResetPasswordDto,
  ) {
    await this.authService.resetPassword(dto.email, dto.otp, dto.newPassword);
    return {
      success: true,
      message: 'Password reset successfully',
    };
  }

  @Post('send-verification-otp')
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 requests per 60 seconds
  async sendVerificationOTP(
    @Body(new ZodValidationPipe(SendVerificationOtpSchema))
    dto: SendVerificationOtpDto,
  ) {
    await this.authService.sendEmailVerificationOTP(dto.email);
    return {
      success: true,
      message: 'Email verification OTP sent to your email',
    };
  }

  @Post('verify-email')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per 60 seconds
  async verifyEmail(
    @Body(new ZodValidationPipe(VerifyEmailSchema)) dto: VerifyEmailDto,
  ) {
    await this.authService.verifyEmail(dto.email, dto.otp);
    return {
      success: true,
      message: 'Email verified successfully',
    };
  }

  @Post('resend-otp')
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 requests per 60 seconds
  async resendOTP(
    @Body(new ZodValidationPipe(ResendOtpSchema)) dto: ResendOtpDto,
  ) {
    // Resend OTP based on type
    if (dto.type === 'PASSWORD_RESET') {
      await this.authService.sendPasswordResetOTP(dto.email);
    } else {
      await this.authService.sendEmailVerificationOTP(dto.email);
    }

    return {
      success: true,
      message: 'OTP resent successfully',
    };
  }
}
