import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { OperatorsService } from './operators.service.js';
import { RegisterOperatorSchema } from './dto/register-operator.dto.js';
import type { RegisterOperatorDto } from './dto/register-operator.dto.js';

@Controller('operators')
@UseGuards(JwtAuthGuard)
export class OperatorsController {
  constructor(private readonly operatorsService: OperatorsService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @CurrentUser() user: any,
    @Body(new ZodValidationPipe(RegisterOperatorSchema)) registerOperatorDto: RegisterOperatorDto,
  ) {
    const profile = await this.operatorsService.register(user.id, registerOperatorDto);
    return {
      success: true,
      data: profile,
      message: 'Operator registered successfully. Awaiting admin approval.',
    };
  }

  @Get('profile/:id')
  async findOne(@Param('id') id: string) {
    const profile = await this.operatorsService.findOne(id);
    return {
      success: true,
      data: profile,
    };
  }

  @Get('dashboard')
  async getDashboard(@CurrentUser() user: any) {
    const dashboard = await this.operatorsService.getDashboard(user.id);
    return {
      success: true,
      data: dashboard,
    };
  }

  @Patch('profile/:id')
  async updateProfile(
    @Param('id') id: string,
    @Body() updateData: any,
  ) {
    const profile = await this.operatorsService.updateProfile(id, updateData);
    return {
      success: true,
      data: profile,
    };
  }

  @Get('documents')
  async getDocuments(@CurrentUser() user: any) {
    const documents = await this.operatorsService.getDocuments(user.id);
    return {
      success: true,
      data: documents,
    };
  }

  @Delete('documents/:documentId')
  @HttpCode(HttpStatus.OK)
  async deleteDocument(
    @CurrentUser() user: any,
    @Param('documentId') documentId: string,
  ) {
    const result = await this.operatorsService.deleteDocument(user.id, documentId);
    return {
      success: true,
      data: result,
    };
  }
}

