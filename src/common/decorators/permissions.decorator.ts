import { SetMetadata } from '@nestjs/common';
import { ControllerPermission } from '@prisma/client';

export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...permissions: ControllerPermission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
