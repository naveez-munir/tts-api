import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a random 6-digit OTP
   */
  generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Store OTP in database with 15-minute expiry
   */
  async storeOTP(
    userId: string,
    email: string,
    type: 'PASSWORD_RESET' | 'EMAIL_VERIFICATION',
  ): Promise<string> {
    const otp = this.generateOTP();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minutes

    // Invalidate previous OTPs of same type for this user
    await this.prisma.otpToken.updateMany({
      where: {
        email,
        type,
        used: false,
      },
      data: {
        used: true,
      },
    });

    // Create new OTP
    await this.prisma.otpToken.create({
      data: {
        userId,
        email,
        otp,
        type,
        expiresAt,
      },
    });

    return otp;
  }

  /**
   * Validate OTP (check if valid, not used, not expired)
   */
  async validateOTP(
    email: string,
    otp: string,
    type: 'PASSWORD_RESET' | 'EMAIL_VERIFICATION',
  ): Promise<boolean> {
    const otpToken = await this.prisma.otpToken.findFirst({
      where: {
        email,
        otp,
        type,
        used: false,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!otpToken) {
      return false;
    }

    // Mark OTP as used
    await this.prisma.otpToken.update({
      where: { id: otpToken.id },
      data: { used: true },
    });

    return true;
  }

  /**
   * Check if user can request new OTP (60 second cooldown)
   */
  async canRequestNewOTP(
    email: string,
    type: 'PASSWORD_RESET' | 'EMAIL_VERIFICATION',
  ): Promise<boolean> {
    const lastOtp = await this.prisma.otpToken.findFirst({
      where: {
        email,
        type,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!lastOtp) return true;

    const cooldownPeriod = 60 * 1000; // 60 seconds
    const timeSinceLastOtp = Date.now() - lastOtp.createdAt.getTime();

    return timeSinceLastOtp >= cooldownPeriod;
  }

  /**
   * Clean up expired OTPs (run periodically via cron)
   */
  async cleanupExpiredOTPs(): Promise<void> {
    await this.prisma.otpToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    this.logger.log('Expired OTPs cleaned up');
  }
}
