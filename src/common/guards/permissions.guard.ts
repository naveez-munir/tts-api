import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service.js';
import { ControllerPermission, UserRole } from '@prisma/client';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<ControllerPermission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    if (user.role === UserRole.ADMIN) {
      return true;
    }

    if (user.role === UserRole.CONTROLLER) {
      if (user.permissions && Array.isArray(user.permissions)) {
        const permissionSet = new Set(user.permissions);
        return requiredPermissions.every(p => permissionSet.has(p));
      }

      const userPermissions = await this.prisma.userPermission.findMany({
        where: { userId: user.id },
        select: { permission: true },
      });

      const permissionSet = new Set(userPermissions.map(p => p.permission));
      const hasPermissions = requiredPermissions.every(p => permissionSet.has(p));

      if (!hasPermissions) {
        throw new ForbiddenException('Insufficient permissions');
      }

      return true;
    }

    throw new ForbiddenException('Invalid user role');
  }
}
