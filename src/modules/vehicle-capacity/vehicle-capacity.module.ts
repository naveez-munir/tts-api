import { Module } from '@nestjs/common';
import { VehicleCapacityService } from './vehicle-capacity.service.js';
import { VehicleCapacityController } from './vehicle-capacity.controller.js';
import { DatabaseModule } from '../../database/database.module.js';

@Module({
  imports: [DatabaseModule],
  controllers: [VehicleCapacityController],
  providers: [VehicleCapacityService],
  exports: [VehicleCapacityService],
})
export class VehicleCapacityModule {}

