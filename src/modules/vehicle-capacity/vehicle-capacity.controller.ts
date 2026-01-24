import { Controller, Get } from '@nestjs/common';
import { VehicleCapacityService } from './vehicle-capacity.service.js';

/**
 * Public controller for vehicle capacities
 * NO authentication required - accessible from landing page
 */
@Controller('api/vehicle-capacities')
export class VehicleCapacityController {
  constructor(private readonly vehicleCapacityService: VehicleCapacityService) {}

  /**
   * GET /api/vehicle-capacities
   * Public endpoint - returns all active vehicle capacities
   * Used by landing page for vehicle selection before login
   */
  @Get()
  async findAll() {
    const capacities = await this.vehicleCapacityService.findAllActive();
    return {
      success: true,
      data: capacities,
    };
  }
}

