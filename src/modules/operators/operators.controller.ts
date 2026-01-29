import {
  Controller,
  Post,
  Get,
  Patch,
  Put,
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
import { UpdateOperatorProfileSchema } from './dto/update-operator-profile.dto.js';
import type { UpdateOperatorProfileDto } from './dto/update-operator-profile.dto.js';
import { UpdateBankDetailsSchema } from './dto/update-bank-details.dto.js';
import type { UpdateBankDetailsDto } from './dto/update-bank-details.dto.js';
import { CreateVehicleSchema, UpdateVehicleSchema } from './dto/vehicle.dto.js';
import type { CreateVehicleDto, UpdateVehicleDto } from './dto/vehicle.dto.js';
import { CreateDriverSchema, UpdateDriverSchema } from './dto/driver.dto.js';
import type { CreateDriverDto, UpdateDriverDto } from './dto/driver.dto.js';
import { UpdateVehiclePhotosSchema } from './dto/vehicle-photo.dto.js';
import type { UpdateVehiclePhotosDto } from './dto/vehicle-photo.dto.js';

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

  @Patch('profile')
  async updateProfile(
    @CurrentUser() user: any,
    @Body(new ZodValidationPipe(UpdateOperatorProfileSchema)) updateData: UpdateOperatorProfileDto,
  ) {
    const profile = await this.operatorsService.updateProfile(user.id, updateData);
    return {
      success: true,
      data: profile,
    };
  }

  @Patch('bank-details')
  async updateBankDetails(
    @CurrentUser() user: any,
    @Body(new ZodValidationPipe(UpdateBankDetailsSchema)) dto: UpdateBankDetailsDto,
  ) {
    const profile = await this.operatorsService.updateBankDetails(user.id, dto);
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

  /**
   * Accept a job offer by quoting the booking reference
   */
  @Post('jobs/:bookingReference/accept')
  @HttpCode(HttpStatus.OK)
  async acceptJob(
    @CurrentUser() user: any,
    @Param('bookingReference') bookingReference: string,
  ) {
    const result = await this.operatorsService.acceptJobOffer(user.id, bookingReference);
    return {
      success: true,
      data: result,
      message: 'Job accepted successfully. Please submit driver details.',
    };
  }

  /**
   * Decline a job offer
   */
  @Post('jobs/:bookingReference/decline')
  @HttpCode(HttpStatus.OK)
  async declineJob(
    @CurrentUser() user: any,
    @Param('bookingReference') bookingReference: string,
  ) {
    const result = await this.operatorsService.declineJobOffer(user.id, bookingReference);
    return {
      success: true,
      data: result,
      message: 'Job declined. It will be offered to the next bidder.',
    };
  }

  /**
   * Get current job offers pending acceptance
   */
  @Get('job-offers')
  async getJobOffers(@CurrentUser() user: any) {
    const offers = await this.operatorsService.getPendingJobOffers(user.id);
    return {
      success: true,
      data: offers,
    };
  }

  @Get('vehicles')
  async getVehicles(@CurrentUser() user: any) {
    const vehicles = await this.operatorsService.getVehicles(user.id);
    return {
      success: true,
      data: vehicles,
    };
  }

  @Get('vehicles/:vehicleId')
  async getVehicle(
    @CurrentUser() user: any,
    @Param('vehicleId') vehicleId: string,
  ) {
    const vehicle = await this.operatorsService.getVehicle(user.id, vehicleId);
    return {
      success: true,
      data: vehicle,
    };
  }

  @Post('vehicles')
  @HttpCode(HttpStatus.CREATED)
  async createVehicle(
    @CurrentUser() user: any,
    @Body(new ZodValidationPipe(CreateVehicleSchema)) dto: CreateVehicleDto,
  ) {
    const vehicle = await this.operatorsService.createVehicle(user.id, dto);
    return {
      success: true,
      data: vehicle,
      message: 'Vehicle added successfully',
    };
  }

  @Patch('vehicles/:vehicleId')
  async updateVehicle(
    @CurrentUser() user: any,
    @Param('vehicleId') vehicleId: string,
    @Body(new ZodValidationPipe(UpdateVehicleSchema)) dto: UpdateVehicleDto,
  ) {
    const vehicle = await this.operatorsService.updateVehicle(user.id, vehicleId, dto);
    return {
      success: true,
      data: vehicle,
      message: 'Vehicle updated successfully',
    };
  }

  @Delete('vehicles/:vehicleId')
  @HttpCode(HttpStatus.OK)
  async deleteVehicle(
    @CurrentUser() user: any,
    @Param('vehicleId') vehicleId: string,
  ) {
    const result = await this.operatorsService.deleteVehicle(user.id, vehicleId);
    return {
      success: true,
      data: result,
      message: 'Vehicle deleted successfully',
    };
  }

  @Get('vehicles/:vehicleId/photos')
  async getVehiclePhotos(
    @CurrentUser() user: any,
    @Param('vehicleId') vehicleId: string,
  ) {
    const photos = await this.operatorsService.getVehiclePhotos(user.id, vehicleId);
    return {
      success: true,
      data: photos,
    };
  }

  @Put('vehicles/:vehicleId/photos')
  async updateVehiclePhotos(
    @CurrentUser() user: any,
    @Param('vehicleId') vehicleId: string,
    @Body(new ZodValidationPipe(UpdateVehiclePhotosSchema)) dto: UpdateVehiclePhotosDto,
  ) {
    const photos = await this.operatorsService.updateVehiclePhotos(user.id, vehicleId, dto);
    return {
      success: true,
      data: photos,
      message: 'Vehicle photos updated successfully',
    };
  }

  @Get('drivers')
  async getDrivers(@CurrentUser() user: any) {
    const drivers = await this.operatorsService.getDrivers(user.id);
    return {
      success: true,
      data: drivers,
    };
  }

  @Get('drivers/:driverId')
  async getDriver(
    @CurrentUser() user: any,
    @Param('driverId') driverId: string,
  ) {
    const driver = await this.operatorsService.getDriver(user.id, driverId);
    return {
      success: true,
      data: driver,
    };
  }

  @Post('drivers')
  @HttpCode(HttpStatus.CREATED)
  async createDriver(
    @CurrentUser() user: any,
    @Body(new ZodValidationPipe(CreateDriverSchema)) dto: CreateDriverDto,
  ) {
    const driver = await this.operatorsService.createDriver(user.id, dto);
    return {
      success: true,
      data: driver,
      message: 'Driver added successfully',
    };
  }

  @Patch('drivers/:driverId')
  async updateDriver(
    @CurrentUser() user: any,
    @Param('driverId') driverId: string,
    @Body(new ZodValidationPipe(UpdateDriverSchema)) dto: UpdateDriverDto,
  ) {
    const driver = await this.operatorsService.updateDriver(user.id, driverId, dto);
    return {
      success: true,
      data: driver,
      message: 'Driver updated successfully',
    };
  }

  @Delete('drivers/:driverId')
  @HttpCode(HttpStatus.OK)
  async deleteDriver(
    @CurrentUser() user: any,
    @Param('driverId') driverId: string,
  ) {
    const result = await this.operatorsService.deleteDriver(user.id, driverId);
    return {
      success: true,
      data: result,
      message: 'Driver deleted successfully',
    };
  }
}

