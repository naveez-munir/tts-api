import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { VehicleType, VehicleCapacity } from '@prisma/client';
import type { UpdateVehicleCapacityDto, VehicleCapacityResponse } from './dto/vehicle-capacity.dto.js';

@Injectable()
export class VehicleCapacityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all active vehicle capacities (for public access)
   */
  async findAllActive(): Promise<VehicleCapacityResponse[]> {
    const capacities = await this.prisma.vehicleCapacity.findMany({
      where: { isActive: true },
      orderBy: { vehicleType: 'asc' },
    });

    return capacities.map(this.mapToResponse);
  }

  /**
   * Get all vehicle capacities including inactive (for admin)
   */
  async findAll(): Promise<VehicleCapacityResponse[]> {
    const capacities = await this.prisma.vehicleCapacity.findMany({
      orderBy: { vehicleType: 'asc' },
    });

    return capacities.map(this.mapToResponse);
  }

  /**
   * Get a single vehicle capacity by vehicle type
   */
  async findByVehicleType(vehicleType: VehicleType): Promise<VehicleCapacityResponse> {
    const capacity = await this.prisma.vehicleCapacity.findUnique({
      where: { vehicleType },
    });

    if (!capacity) {
      throw new NotFoundException(`Vehicle capacity for type ${vehicleType} not found`);
    }

    return this.mapToResponse(capacity);
  }

  /**
   * Update a vehicle capacity (admin only)
   */
  async update(
    vehicleType: VehicleType,
    updateDto: UpdateVehicleCapacityDto,
  ): Promise<VehicleCapacityResponse> {
    const existing = await this.prisma.vehicleCapacity.findUnique({
      where: { vehicleType },
    });

    if (!existing) {
      throw new NotFoundException(`Vehicle capacity for type ${vehicleType} not found`);
    }

    const updated = await this.prisma.vehicleCapacity.update({
      where: { vehicleType },
      data: {
        maxPassengers: updateDto.maxPassengers,
        maxPassengersHandOnly: updateDto.maxPassengersHandOnly,
        maxSuitcases: updateDto.maxSuitcases,
        maxHandLuggage: updateDto.maxHandLuggage,
        rateReductionPer100Miles: updateDto.rateReductionPer100Miles,
        exampleModels: updateDto.exampleModels,
        description: updateDto.description,
        isActive: updateDto.isActive,
      },
    });

    return this.mapToResponse(updated);
  }

  /**
   * Map database entity to response DTO
   */
  private mapToResponse(capacity: VehicleCapacity): VehicleCapacityResponse {
    return {
      id: capacity.id,
      vehicleType: capacity.vehicleType,
      maxPassengers: capacity.maxPassengers,
      maxPassengersHandOnly: capacity.maxPassengersHandOnly,
      maxSuitcases: capacity.maxSuitcases,
      maxHandLuggage: capacity.maxHandLuggage,
      rateReductionPer100Miles: capacity.rateReductionPer100Miles
        ? Number(capacity.rateReductionPer100Miles)
        : null,
      exampleModels: capacity.exampleModels,
      description: capacity.description,
      isActive: capacity.isActive,
    };
  }
}

