import { PrismaClient, VehicleType, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Starting production database seeding...');

  // =========================================================================
  // ADMIN USER - Default admin account
  // =========================================================================
  const adminPassword = await bcrypt.hash('Admin@123456', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@yourcompany.com' }, // ⚠️ CHANGE THIS EMAIL
    update: {},
    create: {
      email: 'admin@yourcompany.com', // ⚠️ CHANGE THIS EMAIL
      password: adminPassword, // ⚠️ CHANGE PASSWORD IN .env: ADMIN_DEFAULT_PASSWORD
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.ADMIN,
      isEmailVerified: true,
      isActive: true,
    },
  });
  console.log('✅ Admin user created/found:', admin.email);

  // =========================================================================
  // SYSTEM SETTINGS - Replace ALL hardcoded values
  // =========================================================================
  console.log('🔧 Seeding system settings...');

  await prisma.systemSetting.deleteMany({}); // Clear existing settings

  const systemSettings = [
    // ===== PRICING DEFAULTS (Fallback values) =====
    {
      category: 'PRICING',
      key: 'BASE_FARE_SALOON',
      value: '15',
      dataType: 'NUMBER',
      description: 'Default base fare for Saloon vehicles (£)',
      isActive: true,
    },
    {
      category: 'PRICING',
      key: 'BASE_FARE_ESTATE',
      value: '18',
      dataType: 'NUMBER',
      description: 'Default base fare for Estate vehicles (£)',
      isActive: true,
    },
    {
      category: 'PRICING',
      key: 'BASE_FARE_MPV',
      value: '25',
      dataType: 'NUMBER',
      description: 'Default base fare for MPV vehicles (£)',
      isActive: true,
    },
    {
      category: 'PRICING',
      key: 'BASE_FARE_EXECUTIVE',
      value: '35',
      dataType: 'NUMBER',
      description: 'Default base fare for Executive vehicles (£)',
      isActive: true,
    },
    {
      category: 'PRICING',
      key: 'BASE_FARE_MINIBUS',
      value: '50',
      dataType: 'NUMBER',
      description: 'Default base fare for Minibus vehicles (£)',
      isActive: true,
    },
    {
      category: 'PRICING',
      key: 'BASE_FARE_EXECUTIVE_LUXURY',
      value: '55',
      dataType: 'NUMBER',
      description: 'Default base fare for Executive Luxury vehicles (£)',
      isActive: true,
    },
    {
      category: 'PRICING',
      key: 'BASE_FARE_EXECUTIVE_PEOPLE_CARRIER',
      value: '45',
      dataType: 'NUMBER',
      description: 'Default base fare for Executive People Carrier vehicles (£)',
      isActive: true,
    },
    {
      category: 'PRICING',
      key: 'BASE_FARE_GREEN_CAR',
      value: '20',
      dataType: 'NUMBER',
      description: 'Default base fare for Green Car (electric) vehicles (£)',
      isActive: true,
    },
    {
      category: 'PRICING',
      key: 'PER_MILE_SALOON',
      value: '2.5',
      dataType: 'NUMBER',
      description: 'Default per-mile rate for Saloon vehicles (£)',
      isActive: true,
    },
    {
      category: 'PRICING',
      key: 'PER_MILE_ESTATE',
      value: '2.75',
      dataType: 'NUMBER',
      description: 'Default per-mile rate for Estate vehicles (£)',
      isActive: true,
    },
    {
      category: 'PRICING',
      key: 'PER_MILE_MPV',
      value: '3.0',
      dataType: 'NUMBER',
      description: 'Default per-mile rate for MPV vehicles (£)',
      isActive: true,
    },
    {
      category: 'PRICING',
      key: 'PER_MILE_EXECUTIVE',
      value: '4.0',
      dataType: 'NUMBER',
      description: 'Default per-mile rate for Executive vehicles (£)',
      isActive: true,
    },
    {
      category: 'PRICING',
      key: 'PER_MILE_MINIBUS',
      value: '4.5',
      dataType: 'NUMBER',
      description: 'Default per-mile rate for Minibus vehicles (£)',
      isActive: true,
    },
    {
      category: 'PRICING',
      key: 'PER_MILE_EXECUTIVE_LUXURY',
      value: '5.0',
      dataType: 'NUMBER',
      description: 'Default per-mile rate for Executive Luxury vehicles (£)',
      isActive: true,
    },
    {
      category: 'PRICING',
      key: 'PER_MILE_EXECUTIVE_PEOPLE_CARRIER',
      value: '4.25',
      dataType: 'NUMBER',
      description: 'Default per-mile rate for Executive People Carrier vehicles (£)',
      isActive: true,
    },
    {
      category: 'PRICING',
      key: 'PER_MILE_GREEN_CAR',
      value: '2.75',
      dataType: 'NUMBER',
      description: 'Default per-mile rate for Green Car (electric) vehicles (£)',
      isActive: true,
    },

    // ===== SURCHARGES =====
    {
      category: 'PRICING',
      key: 'NIGHT_SURCHARGE_PERCENT',
      value: '25',
      dataType: 'NUMBER',
      description: 'Night surcharge percentage (10pm-6am)',
      isActive: true,
    },
    {
      category: 'PRICING',
      key: 'PEAK_SURCHARGE_PERCENT',
      value: '10',
      dataType: 'NUMBER',
      description: 'Peak hours surcharge percentage (7-9am, 5-7pm weekdays)',
      isActive: true,
    },
    {
      category: 'PRICING',
      key: 'HOLIDAY_SURCHARGE_PERCENT',
      value: '50',
      dataType: 'NUMBER',
      description: 'Holiday surcharge percentage (Christmas, New Year)',
      isActive: true,
    },
    {
      category: 'PRICING',
      key: 'MEET_AND_GREET_FEE',
      value: '10',
      dataType: 'NUMBER',
      description: 'Meet & Greet service fee (£)',
      isActive: true,
    },
    {
      category: 'PRICING',
      key: 'RETURN_DISCOUNT_PERCENT',
      value: '5',
      dataType: 'NUMBER',
      description: 'Return journey discount percentage',
      isActive: true,
    },
    {
      category: 'PRICING',
      key: 'NEW_BOOKING_DISCOUNT_PERCENT',
      value: '10',
      dataType: 'NUMBER',
      description: '10% discount for first-time customers',
      isActive: true,
    },

    // ===== TIME WINDOWS =====
    {
      category: 'TIME_WINDOWS',
      key: 'NIGHT_HOURS_START',
      value: '22',
      dataType: 'NUMBER',
      description: 'Night surcharge start hour (24h format, 0-23)',
      isActive: true,
    },
    {
      category: 'TIME_WINDOWS',
      key: 'NIGHT_HOURS_END',
      value: '6',
      dataType: 'NUMBER',
      description: 'Night surcharge end hour (24h format, 0-23)',
      isActive: true,
    },
    {
      category: 'TIME_WINDOWS',
      key: 'PEAK_MORNING_START',
      value: '7',
      dataType: 'NUMBER',
      description: 'Peak morning start hour (24h format, 0-23)',
      isActive: true,
    },
    {
      category: 'TIME_WINDOWS',
      key: 'PEAK_MORNING_END',
      value: '9',
      dataType: 'NUMBER',
      description: 'Peak morning end hour (24h format, 0-23)',
      isActive: true,
    },
    {
      category: 'TIME_WINDOWS',
      key: 'PEAK_EVENING_START',
      value: '17',
      dataType: 'NUMBER',
      description: 'Peak evening start hour (24h format, 0-23)',
      isActive: true,
    },
    {
      category: 'TIME_WINDOWS',
      key: 'PEAK_EVENING_END',
      value: '19',
      dataType: 'NUMBER',
      description: 'Peak evening end hour (24h format, 0-23)',
      isActive: true,
    },
    {
      category: 'TIME_WINDOWS',
      key: 'PEAK_WEEKDAYS_ONLY',
      value: 'true',
      dataType: 'BOOLEAN',
      description: 'Apply peak surcharge only on weekdays (Mon-Fri)',
      isActive: true,
    },

    // ===== HOLIDAY DATES =====
    {
      category: 'HOLIDAYS',
      key: 'CHRISTMAS_START',
      value: '12-24',
      dataType: 'STRING',
      description: 'Christmas period start date (MM-DD format)',
      isActive: true,
    },
    {
      category: 'HOLIDAYS',
      key: 'CHRISTMAS_END',
      value: '12-26',
      dataType: 'STRING',
      description: 'Christmas period end date (MM-DD format)',
      isActive: true,
    },
    {
      category: 'HOLIDAYS',
      key: 'NEW_YEAR_EVE',
      value: '12-31',
      dataType: 'STRING',
      description: 'New Year\'s Eve date (MM-DD format)',
      isActive: true,
    },
    {
      category: 'HOLIDAYS',
      key: 'NEW_YEAR_DAY',
      value: '01-01',
      dataType: 'STRING',
      description: 'New Year\'s Day date (MM-DD format)',
      isActive: true,
    },

    // ===== BIDDING SETTINGS =====
    {
      category: 'BIDDING',
      key: 'DEFAULT_BIDDING_WINDOW_HOURS',
      value: '1',
      dataType: 'NUMBER',
      description: 'Default bidding window duration for one-way bookings (hours)',
      isActive: true,
    },
    {
      category: 'BIDDING',
      key: 'RETURN_BIDDING_WINDOW_HOURS',
      value: '2',
      dataType: 'NUMBER',
      description: 'Default bidding window duration for return journey bookings (hours)',
      isActive: true,
    },
    {
      category: 'BIDDING',
      key: 'REOPEN_BIDDING_DEFAULT_HOURS',
      value: '24',
      dataType: 'NUMBER',
      description: 'Default duration when admin reopens bidding (hours)',
      isActive: true,
    },
    {
      category: 'BIDDING',
      key: 'ENABLE_POSTCODE_FILTERING',
      value: 'true',
      dataType: 'BOOLEAN',
      description: 'Enable postcode-based job filtering for operators (disable to broadcast all jobs to all operators)',
      isActive: true,
    },
    {
      category: 'BIDDING',
      key: 'ACCEPTANCE_WINDOW_MINUTES',
      value: '30',
      dataType: 'NUMBER',
      description: 'Time window in minutes for winning operator to accept a job offer before it goes to the next bidder',
      isActive: true,
    },

    // ===== NOTIFICATION SETTINGS =====
    {
      category: 'NOTIFICATIONS',
      key: 'URGENT_JOB_SMS_THRESHOLD_HOURS',
      value: '24',
      dataType: 'NUMBER',
      description: 'Send SMS to operators if job pickup is within X hours',
      isActive: true,
    },

    // ===== POLICIES - Cancellation =====
    {
      category: 'POLICIES',
      key: 'CANCELLATION_NOTICE_HOURS',
      value: '48',
      dataType: 'NUMBER',
      description: 'Minimum hours notice required for free cancellation',
      isActive: true,
    },
    {
      category: 'POLICIES',
      key: 'LATE_CANCEL_CHARGE_PERCENT',
      value: '100',
      dataType: 'NUMBER',
      description: 'Percentage charged for cancellation within notice period',
      isActive: true,
    },

    // ===== POLICIES - No-Show =====
    {
      category: 'POLICIES',
      key: 'NO_SHOW_CHARGE_PERCENT',
      value: '100',
      dataType: 'NUMBER',
      description: 'Percentage charged for customer no-show',
      isActive: true,
    },
    {
      category: 'POLICIES',
      key: 'NO_SHOW_REFUND_ALLOWED',
      value: 'false',
      dataType: 'BOOLEAN',
      description: 'Whether refunds are allowed for no-show bookings',
      isActive: true,
    },

    // ===== POLICIES - Waiting Time (Airport) =====
    {
      category: 'POLICIES',
      key: 'AIRPORT_FREE_WAITING_MINUTES',
      value: '60',
      dataType: 'NUMBER',
      description: 'Free waiting time for airport pickups (minutes)',
      isActive: true,
    },
    {
      category: 'POLICIES',
      key: 'AIRPORT_WAITING_RATE_PER_MINUTE',
      value: '0.35',
      dataType: 'NUMBER',
      description: 'Rate per minute after free waiting period (£) - Airport',
      isActive: true,
    },

    // ===== POLICIES - Waiting Time (Non-Airport) =====
    {
      category: 'POLICIES',
      key: 'NON_AIRPORT_FREE_WAITING_MINUTES',
      value: '45',
      dataType: 'NUMBER',
      description: 'Free waiting time for non-airport pickups (minutes)',
      isActive: true,
    },
    {
      category: 'POLICIES',
      key: 'NON_AIRPORT_WAITING_RATE_PER_MINUTE',
      value: '0.25',
      dataType: 'NUMBER',
      description: 'Rate per minute after free waiting period (£) - Non-Airport',
      isActive: true,
    },
    {
      category: 'POLICIES',
      key: 'MAX_WAITING_BEFORE_NOSHOW_MINUTES',
      value: '90',
      dataType: 'NUMBER',
      description: 'Maximum waiting time before marking as no-show (minutes)',
      isActive: true,
    },

    // ===== POLICIES - Amendments =====
    {
      category: 'POLICIES',
      key: 'AMENDMENT_FEE',
      value: '15',
      dataType: 'NUMBER',
      description: 'Admin fee for journey amendments (£)',
      isActive: true,
    },

    // ===== SERVICE FEES =====
    {
      category: 'SERVICE_FEES',
      key: 'PICK_AND_DROP_FEE',
      value: '7',
      dataType: 'NUMBER',
      description: 'Pick and Drop service fee (£)',
      isActive: true,
    },
    {
      category: 'SERVICE_FEES',
      key: 'CHILD_SEAT_FEE',
      value: '10',
      dataType: 'NUMBER',
      description: 'Child seat rental fee per seat (£)',
      isActive: true,
    },
    {
      category: 'SERVICE_FEES',
      key: 'BOOSTER_SEAT_FEE',
      value: '5',
      dataType: 'NUMBER',
      description: 'Booster seat rental fee per seat (£)',
      isActive: true,
    },

    // ===== BIDDING - Additional Settings =====
    {
      category: 'BIDDING',
      key: 'BID_SHORTLIST_COUNT',
      value: '3',
      dataType: 'NUMBER',
      description: 'Number of lowest bids to shortlist for selection',
      isActive: true,
    },
    {
      category: 'BIDDING',
      key: 'MIN_BID_PERCENT',
      value: '50',
      dataType: 'NUMBER',
      description: 'Minimum bid as percentage of customer price (prevents unrealistic bids)',
      isActive: true,
    },

    // ===== PAYOUTS =====
    {
      category: 'PAYOUTS',
      key: 'PAYOUTS_ENABLED',
      value: 'true',
      dataType: 'BOOLEAN',
      description: 'Master toggle to enable/disable automatic payout processing',
      isActive: true,
    },
    {
      category: 'PAYOUTS',
      key: 'INITIAL_PAYOUT_DELAY_DAYS',
      value: '14',
      dataType: 'NUMBER',
      description: 'Days before first payout for new operators',
      isActive: true,
    },
    {
      category: 'PAYOUTS',
      key: 'PAYOUT_FREQUENCY',
      value: 'WEEKLY',
      dataType: 'STRING',
      description: 'Payout frequency (WEEKLY or BIWEEKLY)',
      isActive: true,
    },
    {
      category: 'PAYOUTS',
      key: 'JOBS_HELD_FOR_NEXT_PAYOUT',
      value: '2',
      dataType: 'NUMBER',
      description: 'Number of recent jobs held back for next payout cycle',
      isActive: true,
    },
    {
      category: 'PAYOUTS',
      key: 'PAYOUT_DAY_OF_WEEK',
      value: '5',
      dataType: 'NUMBER',
      description: 'Day of week to process payouts (0=Sun, 1=Mon, ..., 5=Fri, 6=Sat)',
      isActive: true,
    },
    {
      category: 'PAYOUTS',
      key: 'ADMIN_PAYOUT_EMAIL',
      value: 'admin@yourcompany.com', // ⚠️ CHANGE THIS EMAIL
      dataType: 'STRING',
      description: 'Email address to receive payout summary notifications',
      isActive: true,
    },
  ];

  await prisma.systemSetting.createMany({
    data: systemSettings,
  });

  console.log(`✅ Created ${systemSettings.length} system settings`);

  // =========================================================================
  // VEHICLE CAPACITIES - Configuration for each vehicle type
  // =========================================================================
  console.log('🚗 Seeding vehicle capacities...');

  await prisma.vehicleCapacity.deleteMany({});

  const vehicleCapacities = [
    {
      vehicleType: VehicleType.SALOON,
      maxPassengers: 3,
      maxPassengersHandOnly: 4,
      maxSuitcases: 3,
      maxHandLuggage: 2,
      rateReductionPer100Miles: 0.30, // 30p reduction per 100 miles
      exampleModels: 'Ford Mondeo, VW Passat',
      description: 'Standard saloon car for up to 3 passengers with luggage or 4 with hand luggage only',
      isActive: true,
    },
    {
      vehicleType: VehicleType.ESTATE,
      maxPassengers: 4,
      maxPassengersHandOnly: null,
      maxSuitcases: 4,
      maxHandLuggage: 2,
      rateReductionPer100Miles: 0.15, // 15p reduction per 100 miles
      exampleModels: 'Volvo Estate, VW Passat Estate',
      description: 'Estate car with extra luggage space for up to 4 passengers',
      isActive: true,
    },
    {
      vehicleType: VehicleType.MPV,
      maxPassengers: 5,
      maxPassengersHandOnly: 6,
      maxSuitcases: 5,
      maxHandLuggage: 4,
      rateReductionPer100Miles: 0.30, // 30p reduction per 100 miles
      exampleModels: 'VW Sharan, Ford Galaxy',
      description: 'People carrier for up to 5 passengers with luggage or 6 with hand luggage only',
      isActive: true,
    },
    {
      vehicleType: VehicleType.EXECUTIVE,
      maxPassengers: 3,
      maxPassengersHandOnly: 4,
      maxSuitcases: 3,
      maxHandLuggage: 2,
      rateReductionPer100Miles: 0.25, // 25p reduction per 100 miles
      exampleModels: 'Mercedes E-Class, BMW 5 Series',
      description: 'Premium executive sedan for up to 3 passengers with luggage',
      isActive: true,
    },
    {
      vehicleType: VehicleType.EXECUTIVE_LUXURY,
      maxPassengers: 3,
      maxPassengersHandOnly: null,
      maxSuitcases: 2,
      maxHandLuggage: 2,
      rateReductionPer100Miles: 0.20, // 20p reduction per 100 miles
      exampleModels: 'Mercedes S-Class, BMW 7 Series',
      description: 'Luxury executive sedan for up to 3 passengers',
      isActive: true,
    },
    {
      vehicleType: VehicleType.EXECUTIVE_PEOPLE_CARRIER,
      maxPassengers: 5,
      maxPassengersHandOnly: 6,
      maxSuitcases: 5,
      maxHandLuggage: 4,
      rateReductionPer100Miles: 0.20, // 20p reduction per 100 miles
      exampleModels: 'Mercedes V-Class, VW Caravelle',
      description: 'Executive people carrier for up to 5 passengers with luggage or 6 with hand luggage',
      isActive: true,
    },
    {
      vehicleType: VehicleType.GREEN_CAR,
      maxPassengers: 3,
      maxPassengersHandOnly: 4,
      maxSuitcases: 2,
      maxHandLuggage: 2,
      rateReductionPer100Miles: null, // No reduction for green car
      exampleModels: 'Tesla Model 3, Tesla Model S, BMW i4',
      description: 'Electric vehicle for eco-conscious travel, up to 3 passengers with luggage',
      isActive: true,
    },
    {
      vehicleType: VehicleType.MINIBUS,
      maxPassengers: 8,
      maxPassengersHandOnly: null,
      maxSuitcases: 8,
      maxHandLuggage: 8,
      rateReductionPer100Miles: 0.20, // 20p reduction per 100 miles
      exampleModels: 'VW Transporter, Mercedes Sprinter',
      description: '8-seater minibus for larger groups with up to 8 suitcases',
      isActive: true,
    },
  ];

  await prisma.vehicleCapacity.createMany({
    data: vehicleCapacities,
  });

  console.log(`✅ Created ${vehicleCapacities.length} vehicle capacities`);

  // =========================================================================
  // CANCELLATION POLICIES
  // =========================================================================
  console.log('📋 Seeding cancellation policies...');

  await prisma.cancellationPolicy.deleteMany({});

  const cancellationPolicies = [
    {
      name: 'Full Refund',
      hoursBeforePickup: 48,
      refundPercent: 100,
      description: 'Cancel 48+ hours before pickup for full refund',
      sortOrder: 1,
      isActive: true,
    },
    {
      name: 'Partial Refund',
      hoursBeforePickup: 24,
      refundPercent: 50,
      description: 'Cancel 24-48 hours before pickup for 50% refund',
      sortOrder: 2,
      isActive: true,
    },
    {
      name: 'No Refund',
      hoursBeforePickup: 0,
      refundPercent: 0,
      description: 'Cancel less than 24 hours before pickup - no refund',
      sortOrder: 3,
      isActive: true,
    },
  ];

  await prisma.cancellationPolicy.createMany({
    data: cancellationPolicies,
  });

  console.log(`✅ Created ${cancellationPolicies.length} cancellation policies`);

  console.log('✨ Production database seeding completed successfully!');
}

main()
  .catch((error) => {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
