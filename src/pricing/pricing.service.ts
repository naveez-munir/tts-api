import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PricingRule, PricingRuleType } from './entities/pricing-rule.entity';
import { VehicleType } from '../common/enums';

@Injectable()
export class PricingService {
  constructor(
    @InjectRepository(PricingRule)
    private pricingRuleRepo: Repository<PricingRule>,
  ) {}

  async getActiveRules(): Promise<PricingRule[]> {
    return this.pricingRuleRepo.find({
      where: { isActive: true },
    });
  }

  async getBaseFare(vehicleType: VehicleType): Promise<number> {
    const rule = await this.pricingRuleRepo.findOne({
      where: {
        ruleType: PricingRuleType.BASE_FARE,
        vehicleType,
        isActive: true,
      },
    });
    return rule ? Number(rule.baseAmount) : this.getDefaultBaseFare(vehicleType);
  }

  async getPerMileRate(vehicleType: VehicleType): Promise<number> {
    const rule = await this.pricingRuleRepo.findOne({
      where: {
        ruleType: PricingRuleType.PER_MILE,
        vehicleType,
        isActive: true,
      },
    });
    return rule ? Number(rule.baseAmount) : this.getDefaultPerMileRate(vehicleType);
  }

  async getMeetAndGreetFee(): Promise<number> {
    const rule = await this.pricingRuleRepo.findOne({
      where: {
        ruleType: PricingRuleType.MEET_AND_GREET,
        isActive: true,
      },
    });
    return rule ? Number(rule.baseAmount) : 10.0; // Default £10
  }

  async getAirportFee(airportCode: string): Promise<number> {
    const rule = await this.pricingRuleRepo.findOne({
      where: {
        ruleType: PricingRuleType.AIRPORT_FEE,
        airportCode: airportCode.toUpperCase(),
        isActive: true,
      },
    });
    return rule ? Number(rule.baseAmount) : 0;
  }

  async getTimeSurcharge(pickupTime: Date): Promise<{ percentage: number; description: string } | null> {
    const hours = pickupTime.getHours();
    const timeStr = `${hours.toString().padStart(2, '0')}:00`;

    const rules = await this.pricingRuleRepo.find({
      where: {
        ruleType: PricingRuleType.TIME_SURCHARGE,
        isActive: true,
      },
    });

    for (const rule of rules) {
      if (rule.startTime && rule.endTime) {
        if (this.isTimeInRange(timeStr, rule.startTime, rule.endTime)) {
          return {
            percentage: Number(rule.percentage),
            description: rule.description || 'Time surcharge',
          };
        }
      }
    }

    // Default night surcharge (22:00 - 06:00) if no rule found
    if (hours >= 22 || hours < 6) {
      return { percentage: 20, description: 'Night rate (22:00-06:00)' };
    }

    return null;
  }

  async getHolidaySurcharge(pickupDate: Date): Promise<{ percentage: number; description: string } | null> {
    const rules = await this.pricingRuleRepo.find({
      where: {
        ruleType: PricingRuleType.HOLIDAY_SURCHARGE,
        isActive: true,
      },
    });

    for (const rule of rules) {
      if (rule.startDate && rule.endDate) {
        if (pickupDate >= rule.startDate && pickupDate <= rule.endDate) {
          return {
            percentage: Number(rule.percentage),
            description: rule.description || 'Holiday surcharge',
          };
        }
      }
    }

    return null;
  }

  private isTimeInRange(time: string, start: string, end: string): boolean {
    // Handle overnight ranges (e.g., 22:00 - 06:00)
    if (start > end) {
      return time >= start || time < end;
    }
    return time >= start && time < end;
  }

  private getDefaultBaseFare(vehicleType: VehicleType): number {
    const defaults: Record<VehicleType, number> = {
      [VehicleType.SALOON]: 5.0,
      [VehicleType.ESTATE]: 7.0,
      [VehicleType.MPV]: 10.0,
      [VehicleType.EXECUTIVE]: 15.0,
      [VehicleType.MINIBUS]: 25.0,
    };
    return defaults[vehicleType];
  }

  private getDefaultPerMileRate(vehicleType: VehicleType): number {
    const defaults: Record<VehicleType, number> = {
      [VehicleType.SALOON]: 2.0,
      [VehicleType.ESTATE]: 2.5,
      [VehicleType.MPV]: 3.0,
      [VehicleType.EXECUTIVE]: 4.0,
      [VehicleType.MINIBUS]: 5.0,
    };
    return defaults[vehicleType];
  }
}
