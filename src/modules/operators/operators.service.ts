import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { OperatorProfile, OperatorApprovalStatus, JobStatus } from '@prisma/client';
import type { RegisterOperatorDto } from './dto/register-operator.dto.js';
import type { UpdateBankDetailsDto } from './dto/update-bank-details.dto.js';

@Injectable()
export class OperatorsService {
  constructor(private readonly prisma: PrismaService) {}

  async register(userId: string, registerOperatorDto: RegisterOperatorDto): Promise<OperatorProfile> {
    // Check if operator profile already exists
    const existingProfile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
    });

    if (existingProfile) {
      throw new BadRequestException('Operator profile already exists for this user');
    }

    // Create operator profile with PENDING approval status
    const profile = await this.prisma.operatorProfile.create({
      data: {
        userId,
        companyName: registerOperatorDto.companyName,
        registrationNumber: registerOperatorDto.registrationNumber,
        vatNumber: registerOperatorDto.vatNumber || null,
        approvalStatus: OperatorApprovalStatus.PENDING,
      },
    });

    // Create service areas
    for (const postcode of registerOperatorDto.serviceAreas) {
      await this.prisma.serviceArea.create({
        data: {
          operatorId: profile.id,
          postcode,
        },
      });
    }

    return profile;
  }

  async findOne(id: string): Promise<OperatorProfile> {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { id },
      include: {
        user: true,
        vehicles: true,
        serviceAreas: true,
      },
    });

    if (!profile) {
      throw new NotFoundException(`Operator with ID ${id} not found`);
    }

    return profile;
  }

  async findByUserId(userId: string): Promise<OperatorProfile> {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
      include: {
        user: true,
        vehicles: true,
        serviceAreas: true,
        bids: true,
      },
    });

    if (!profile) {
      throw new NotFoundException(`Operator profile not found for user ${userId}`);
    }

    return profile;
  }

  async getDashboard(userId: string): Promise<any> {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
      include: {
        user: true,
        vehicles: true,
        serviceAreas: true,
        bids: true,
      },
    });

    if (!profile) {
      throw new NotFoundException(`Operator profile not found for user ${userId}`);
    }

    // Get stats
    const totalBids = await this.prisma.bid.count({
      where: { operatorId: profile.id },
    });

    const wonBids = await this.prisma.bid.count({
      where: {
        operatorId: profile.id,
        status: 'WON',
      },
    });

    // Use the correct JobStatus enum value
    const availableJobs = await this.prisma.job.findMany({
      where: {
        status: JobStatus.OPEN_FOR_BIDDING,
        booking: {
          pickupPostcode: {
            startsWith: profile.serviceAreas[0]?.postcode.substring(0, 3) || '',
          },
        },
      },
    });

    return {
      profile,
      stats: {
        totalBids,
        wonBids,
        availableJobs: availableJobs.length,
        reputationScore: profile.reputationScore,
        totalJobs: profile.totalJobs,
        completedJobs: profile.completedJobs,
        approvalStatus: profile.approvalStatus,
      },
    };
  }

  async updateProfile(id: string, data: Partial<OperatorProfile>): Promise<OperatorProfile> {
    return this.prisma.operatorProfile.update({
      where: { id },
      data,
    });
  }

  async updateBankDetails(userId: string, dto: UpdateBankDetailsDto): Promise<OperatorProfile> {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException(`Operator profile not found for user ${userId}`);
    }

    return this.prisma.operatorProfile.update({
      where: { id: profile.id },
      data: {
        bankAccountName: dto.bankAccountName,
        bankAccountNumber: dto.bankAccountNumber,
        bankSortCode: dto.bankSortCode,
      },
    });
  }

  async getBankDetails(userId: string): Promise<{ bankAccountName: string | null; bankAccountNumber: string | null; bankSortCode: string | null }> {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
      select: {
        bankAccountName: true,
        bankAccountNumber: true,
        bankSortCode: true,
      },
    });

    if (!profile) {
      throw new NotFoundException(`Operator profile not found for user ${userId}`);
    }

    return profile;
  }
}

