import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { VehicleType } from '../../common/enums';

export enum PricingRuleType {
  BASE_FARE = 'BASE_FARE',
  PER_MILE = 'PER_MILE',
  TIME_SURCHARGE = 'TIME_SURCHARGE',
  HOLIDAY_SURCHARGE = 'HOLIDAY_SURCHARGE',
  AIRPORT_FEE = 'AIRPORT_FEE',
  MEET_AND_GREET = 'MEET_AND_GREET',
}

@Entity('pricing_rules')
@Index(['ruleType'])
@Index(['vehicleType'])
@Index(['isActive'])
export class PricingRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'rule_type',
    type: 'enum',
    enum: PricingRuleType,
  })
  ruleType: PricingRuleType;

  @Column({
    name: 'vehicle_type',
    type: 'enum',
    enum: VehicleType,
    nullable: true,
  })
  vehicleType: VehicleType;

  @Column({ name: 'base_amount', type: 'decimal', precision: 10, scale: 2 })
  baseAmount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  percentage: number;

  // Time-based rules (HH:MM format)
  @Column({ name: 'start_time', nullable: true })
  startTime: string;

  @Column({ name: 'end_time', nullable: true })
  endTime: string;

  // Date-based rules
  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: Date;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: Date;

  // Airport-specific
  @Column({ name: 'airport_code', nullable: true })
  airportCode: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ nullable: true })
  description: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
