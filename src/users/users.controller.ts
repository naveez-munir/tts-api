import { Controller, Patch, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { UsersService } from './users.service.js';
import { UpdateCustomerProfileSchema } from './dto/update-customer-profile.dto.js';
import type { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto.js';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('profile')
  async updateProfile(
    @CurrentUser() user: any,
    @Body(new ZodValidationPipe(UpdateCustomerProfileSchema)) updateData: UpdateCustomerProfileDto,
  ) {
    const updatedUser = await this.usersService.update(user.id, {
      firstName: updateData.firstName,
      lastName: updateData.lastName,
      phoneNumber: updateData.phoneNumber,
    });

    return {
      success: true,
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        phoneNumber: updatedUser.phoneNumber,
      },
    };
  }
}
