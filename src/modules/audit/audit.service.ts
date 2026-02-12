import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CreateAuditLogDto } from './dto/create-audit-log.dto.js';
import { AuditLogsQueryDto } from './dto/audit-logs-query.dto.js';
import { AuditLog } from '@prisma/client';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: CreateAuditLogDto): Promise<AuditLog> {
    return this.prisma.auditLog.create({
      data: {
        userId: entry.userId,
        userEmail: entry.userEmail,
        userRole: entry.userRole,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        description: entry.description,
        previousValue: entry.previousValue,
        newValue: entry.newValue,
        reason: entry.reason,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
      },
    });
  }

  async getAuditLogs(query: AuditLogsQueryDto) {
    const { page, limit, userId, action, targetType, targetId, dateFrom, dateTo } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (targetType) where.targetType = targetType;
    if (targetId) where.targetId = targetId;

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserActivity(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where: { userId } }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
