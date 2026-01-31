import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service.js';
import { OtpService } from './otp.service.js';
import { ResendService } from '../integrations/resend/resend.service.js';
import * as bcrypt from 'bcrypt';
import type { User } from '@prisma/client';

interface JwtPayload {
  email: string;
  sub: string;
  role: string;
}

export interface AuthResponse {
  access_token: string;
  user: Omit<User, 'password'>;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly otpService: OtpService,
    private readonly resendService: ResendService,
  ) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<Omit<User, 'password'> | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return null;

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async login(user: User): Promise<AuthResponse> {
    const payload: JwtPayload = {
      email: user.email,
      sub: user.id,
      role: user.role,
    };

    const { password: _, ...userWithoutPassword } = user;

    return {
      access_token: this.jwtService.sign(payload),
      user: userWithoutPassword,
    };
  }

  /**
   * Send password reset OTP to user's email
   */
  async sendPasswordResetOTP(email: string): Promise<void> {
    // Check if user exists
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User with this email does not exist');
    }

    // Check cooldown period
    const canRequest = await this.otpService.canRequestNewOTP(
      email,
      'PASSWORD_RESET',
    );
    if (!canRequest) {
      throw new BadRequestException(
        'Please wait 60 seconds before requesting a new OTP',
      );
    }

    // Generate and store OTP
    const otp = await this.otpService.storeOTP(
      user.id,
      email,
      'PASSWORD_RESET',
    );

    // Send OTP via email
    await this.resendService.sendPasswordResetOTP(email, {
      firstName: user.firstName,
      lastName: user.lastName,
      otp,
    });
  }

  /**
   * Reset user password using OTP
   */
  async resetPassword(
    email: string,
    otp: string,
    newPassword: string,
  ): Promise<void> {
    const isValid = await this.otpService.validateOTP(
      email,
      otp,
      'PASSWORD_RESET',
    );
    if (!isValid) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.usersService.updatePassword(user.id, hashedPassword);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.usersService.updatePassword(user.id, hashedPassword);
  }

  /**
   * Send email verification OTP to user's email
   */
  async sendEmailVerificationOTP(email: string): Promise<void> {
    // Check if user exists
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User with this email does not exist');
    }

    // Check if already verified
    if (user.isEmailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    // Check cooldown period
    const canRequest = await this.otpService.canRequestNewOTP(
      email,
      'EMAIL_VERIFICATION',
    );
    if (!canRequest) {
      throw new BadRequestException(
        'Please wait 60 seconds before requesting a new OTP',
      );
    }

    // Generate and store OTP
    const otp = await this.otpService.storeOTP(
      user.id,
      email,
      'EMAIL_VERIFICATION',
    );

    // Send OTP via email
    await this.resendService.sendEmailVerificationOTP(email, {
      firstName: user.firstName,
      lastName: user.lastName,
      otp,
    });
  }

  /**
   * Verify user email using OTP
   */
  async verifyEmail(email: string, otp: string): Promise<void> {
    // Validate OTP
    const isValid = await this.otpService.validateOTP(
      email,
      otp,
      'EMAIL_VERIFICATION',
    );
    if (!isValid) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Find user
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Mark email as verified
    await this.usersService.markEmailAsVerified(user.id);
  }
}
