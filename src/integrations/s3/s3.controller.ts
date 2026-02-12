import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { S3Service } from './s3.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  GenerateUploadUrlSchema,
  ConfirmUploadSchema,
} from './dto/upload.dto.js';
import type { GenerateUploadUrlDto, ConfirmUploadDto } from './dto/upload.dto.js';
import { UserRole, DocumentType } from '@prisma/client';

@Controller('uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class S3Controller {
  constructor(
    private readonly s3Service: S3Service,
    private readonly prisma: PrismaService,
  ) {}

  @Post('presigned-url')
  @Roles(UserRole.OPERATOR)
  async generateUploadUrl(
    @CurrentUser() user: { id: string; operatorProfile?: { id: string } },
    @Body(new ZodValidationPipe(GenerateUploadUrlSchema)) dto: GenerateUploadUrlDto,
  ) {
    // Fetch operator profile
    const operatorProfile = await this.prisma.operatorProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!operatorProfile) {
      throw new Error('Operator profile not found');
    }

    const result = await this.s3Service.generateUploadUrl(
      operatorProfile.id,
      dto.fileName,
      dto.fileType,
      dto.documentType,
    );

    return {
      success: true,
      data: {
        ...result,
        maxFileSize: this.s3Service.getMaxFileSize(),
      },
    };
  }

  @Post('confirm')
  @Roles(UserRole.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async confirmUpload(
    @CurrentUser() user: { id: string; operatorProfile?: { id: string } },
    @Body(new ZodValidationPipe(ConfirmUploadSchema)) dto: ConfirmUploadDto,
  ) {
    // Fetch operator profile
    const operatorProfile = await this.prisma.operatorProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!operatorProfile) {
      throw new Error('Operator profile not found');
    }

    const operatorId = operatorProfile.id;

    // Verify file exists in S3
    const exists = await this.s3Service.fileExists(dto.key);
    if (!exists) {
      throw new Error('File not found in storage. Please upload the file first.');
    }

    // Map string to DocumentType enum
    const documentTypeMap: Record<string, DocumentType> = {
      license: DocumentType.OPERATING_LICENSE,
      insurance: DocumentType.INSURANCE,
      company_registration: DocumentType.COMPANY_REGISTRATION,
      other: DocumentType.OTHER,
    };

    // Create document record in database
    const document = await this.prisma.document.create({
      data: {
        operatorId,
        documentType: documentTypeMap[dto.documentType],
        fileName: dto.originalFileName,
        fileUrl: dto.key,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });

    // Reset approval status to PENDING so admin re-reviews the new document
    await this.prisma.operatorProfile.update({
      where: { id: operatorId },
      data: { approvalStatus: 'PENDING' },
    });

    return {
      success: true,
      data: {
        id: document.id,
        documentType: document.documentType,
        fileName: document.fileName,
        uploadedAt: document.uploadedAt,
        expiresAt: document.expiresAt,
      },
    };
  }

  @Get(':documentId/download-url')
  @Roles(UserRole.OPERATOR, UserRole.ADMIN)
  async getDownloadUrl(
    @CurrentUser() user: { id: string; role: UserRole; operatorProfile?: { id: string } },
    @Param('documentId') documentId: string,
  ) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    // Check authorization: admin can access all, operators can only access their own
    if (user.role !== UserRole.ADMIN) {
      const operatorProfile = await this.prisma.operatorProfile.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });

      if (!operatorProfile || document.operatorId !== operatorProfile.id) {
        throw new Error('Not authorized to access this document');
      }
    }

    const result = await this.s3Service.generateDownloadUrl(document.fileUrl);

    return {
      success: true,
      data: {
        downloadUrl: result.downloadUrl,
        fileName: document.fileName,
        expiresIn: result.expiresIn,
      },
    };
  }
}

