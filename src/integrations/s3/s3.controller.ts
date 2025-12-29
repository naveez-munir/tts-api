import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  UsePipes,
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
  @UsePipes(new ZodValidationPipe(GenerateUploadUrlSchema))
  async generateUploadUrl(
    @CurrentUser() user: { id: string; operatorProfile?: { id: string } },
    @Body() dto: GenerateUploadUrlDto,
  ) {
    const operatorId = user.operatorProfile?.id;
    if (!operatorId) {
      throw new Error('Operator profile not found');
    }

    const result = await this.s3Service.generateUploadUrl(
      operatorId,
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
  @UsePipes(new ZodValidationPipe(ConfirmUploadSchema))
  async confirmUpload(
    @CurrentUser() user: { id: string; operatorProfile?: { id: string } },
    @Body() dto: ConfirmUploadDto,
  ) {
    const operatorId = user.operatorProfile?.id;
    if (!operatorId) {
      throw new Error('Operator profile not found');
    }

    // Verify file exists in S3
    const exists = await this.s3Service.fileExists(dto.key);
    if (!exists) {
      throw new Error('File not found in storage. Please upload the file first.');
    }

    // Map string to DocumentType enum
    const documentTypeMap: Record<string, DocumentType> = {
      license: DocumentType.OPERATING_LICENSE,
      insurance: DocumentType.INSURANCE,
      other: DocumentType.OTHER,
    };

    // Create document record in database
    const document = await this.prisma.document.create({
      data: {
        operatorId,
        documentType: documentTypeMap[dto.documentType],
        fileName: dto.originalFileName,
        fileUrl: dto.key,
      },
    });

    return {
      success: true,
      data: {
        documentId: document.id,
        documentType: document.documentType,
        fileName: document.fileName,
        uploadedAt: document.uploadedAt,
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
    if (user.role !== UserRole.ADMIN && document.operatorId !== user.operatorProfile?.id) {
      throw new Error('Not authorized to access this document');
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

