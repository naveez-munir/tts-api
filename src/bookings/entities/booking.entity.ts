import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/users.entity';
import {
  BookingStatus,
  ServiceType,
  VehicleType,
} from '../../common/enums';
import { Transaction } from './transaction.entity';

@Entity('bookings')
@Index(['bookingReference'])
@Index(['customerId'])
@Index(['status'])
@Index(['pickupDatetime'])
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'booking_reference', unique: true })
  bookingReference: string;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @Column({
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.PENDING_PAYMENT,
  })
  status: BookingStatus;

  // Journey Details
  @Column({
    name: 'service_type',
    type: 'enum',
    enum: ServiceType,
  })
  serviceType: ServiceType;

  @Column({ name: 'pickup_address' })
  pickupAddress: string;

  @Column({ name: 'pickup_postcode' })
  pickupPostcode: string;

  @Column({ name: 'pickup_lat', type: 'decimal', precision: 10, scale: 8 })
  pickupLat: number;

  @Column({ name: 'pickup_lng', type: 'decimal', precision: 11, scale: 8 })
  pickupLng: number;

  @Column({ name: 'dropoff_address' })
  dropoffAddress: string;

  @Column({ name: 'dropoff_postcode' })
  dropoffPostcode: string;

  @Column({ name: 'dropoff_lat', type: 'decimal', precision: 10, scale: 8 })
  dropoffLat: number;

  @Column({ name: 'dropoff_lng', type: 'decimal', precision: 11, scale: 8 })
  dropoffLng: number;

  @Column({ name: 'pickup_datetime', type: 'timestamptz' })
  pickupDatetime: Date;

  // Passenger & Vehicle
  @Column({ name: 'passenger_count' })
  passengerCount: number;

  @Column({ name: 'luggage_count' })
  luggageCount: number;

  @Column({
    name: 'vehicle_type',
    type: 'enum',
    enum: VehicleType,
  })
  vehicleType: VehicleType;

  // Optional Fields
  @Column({ name: 'flight_number', nullable: true })
  flightNumber: string;

  @Column({ nullable: true })
  terminal: string;

  @Column({ name: 'has_meet_and_greet', default: false })
  hasMeetAndGreet: boolean;

  @Column({ name: 'special_requirements', type: 'jsonb', nullable: true })
  specialRequirements: {
    childSeats?: number;
    wheelchairAccess?: boolean;
    pets?: boolean;
  };

  @Column({ name: 'via_points', type: 'jsonb', nullable: true })
  viaPoints: Array<{
    address: string;
    postcode: string;
    lat: number;
    lng: number;
  }>;

  // Pricing
  @Column({ name: 'distance_miles', type: 'decimal', precision: 10, scale: 2 })
  distanceMiles: number;

  @Column({ name: 'duration_minutes' })
  durationMinutes: number;

  @Column({ name: 'quoted_price', type: 'decimal', precision: 10, scale: 2 })
  quotedPrice: number;

  @Column({ name: 'is_return_journey', default: false })
  isReturnJourney: boolean;

  @Column({ name: 'return_booking_id', type: 'uuid', nullable: true })
  returnBookingId: string;

  // Customer Details
  @Column({ name: 'customer_name' })
  customerName: string;

  @Column({ name: 'customer_email' })
  customerEmail: string;

  @Column({ name: 'customer_phone' })
  customerPhone: string;

  // Timestamps
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date;

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: 'customer_id' })
  customer: User;

  @OneToMany(() => Transaction, (transaction) => transaction.booking)
  transactions: Transaction[];

  @OneToOne(() => Booking)
  @JoinColumn({ name: 'return_booking_id' })
  returnBooking: Booking;
}
