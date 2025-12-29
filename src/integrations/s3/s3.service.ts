import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface UploadUrlResponse {
  uploadUrl: string;
  key: string;
  expiresIn: number;
}

export interface DownloadUrlResponse {
  downloadUrl: string;
  expiresIn: number;
}

export type AllowedFileType = 'pdf' | 'jpg' | 'jpeg' | 'png';

const ALLOWED_MIME_TYPES: Record<AllowedFileType, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET') || '';

    this.s3Client = new S3Client({
      region: this.configService.get<string>('AWS_REGION') || 'eu-west-2',
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || '',
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '',
      },
    });
  }

  /**
   * Generate a pre-signed URL for uploading a file
   */
  async generateUploadUrl(
    operatorId: string,
    fileName: string,
    fileType: AllowedFileType,
    documentType: string,
  ): Promise<UploadUrlResponse> {
    this.validateFileType(fileType);

    const key = this.generateKey(operatorId, documentType, fileName, fileType);
    const contentType = ALLOWED_MIME_TYPES[fileType];
    const expiresIn = 3600; // 1 hour

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn });

    this.logger.log(`Generated upload URL for ${key}`);

    return {
      uploadUrl,
      key,
      expiresIn,
    };
  }

  /**
   * Generate a pre-signed URL for downloading a file
   */
  async generateDownloadUrl(key: string): Promise<DownloadUrlResponse> {
    const expiresIn = 3600; // 1 hour

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const downloadUrl = await getSignedUrl(this.s3Client, command, { expiresIn });

    return {
      downloadUrl,
      expiresIn,
    };
  }

  /**
   * Delete a file from S3
   */
  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.s3Client.send(command);
    this.logger.log(`Deleted file: ${key}`);
  }

  /**
   * Check if a file exists in S3
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      await this.s3Client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate file type
   */
  private validateFileType(fileType: string): void {
    if (!Object.keys(ALLOWED_MIME_TYPES).includes(fileType.toLowerCase())) {
      throw new BadRequestException(
        `Invalid file type: ${fileType}. Allowed types: ${Object.keys(ALLOWED_MIME_TYPES).join(', ')}`,
      );
    }
  }

  /**
   * Generate S3 key for document storage
   * Format: operators/{operatorId}/{documentType}/{timestamp}-{fileName}.{extension}
   */
  private generateKey(
    operatorId: string,
    documentType: string,
    fileName: string,
    fileType: AllowedFileType,
  ): string {
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const timestamp = Date.now();
    return `operators/${operatorId}/${documentType}/${timestamp}-${sanitizedFileName}.${fileType}`;
  }

  /**
   * Get max file size in bytes
   */
  getMaxFileSize(): number {
    return MAX_FILE_SIZE;
  }
}

