import { PrismaClient, UserRole, VehicleType, Prisma, JourneyType, DiscountType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Starting database seeding...');

  // Create admin user
  const adminPassword = await bcrypt.hash('Admin@123456', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.ADMIN,
      isEmailVerified: true,
      isActive: true,
    },
  });
  console.log('✅ Admin user created/found:', admin.email);

  // Create sample customer
  const customerPassword = await bcrypt.hash('Customer@123456', 10);
  const customer = await prisma.user.upsert({
    where: { email: 'customer@example.com' },
    update: {},
    create: {
      email: 'customer@example.com',
      password: customerPassword,
      firstName: 'John',
      lastName: 'Doe',
      phoneNumber: '+441234567890',
      role: UserRole.CUSTOMER,
      isEmailVerified: true,
      isActive: true,
    },
  });
  console.log('✅ Customer user created/found:', customer.email);

  // Create sample operator
  const operatorPassword = await bcrypt.hash('Operator@123456', 10);
  const operator = await prisma.user.upsert({
    where: { email: 'operator@example.com' },
    update: {},
    create: {
      email: 'operator@example.com',
      password: operatorPassword,
      firstName: 'Jane',
      lastName: 'Smith',
      phoneNumber: '+441234567891',
      role: UserRole.OPERATOR,
      isEmailVerified: true,
      isActive: true,
    },
  });
  console.log('✅ Operator user created/found:', operator.email);

  // Create operator profile
  const operatorProfile = await prisma.operatorProfile.upsert({
    where: { userId: operator.id },
    update: {},
    create: {
      userId: operator.id,
      companyName: 'Premium Transfers Ltd',
      registrationNumber: 'REG123456',
      vatNumber: 'VAT123456789',
      approvalStatus: 'APPROVED',
      reputationScore: new Prisma.Decimal('4.8'),
    },
  });
  console.log('✅ Operator profile created/found:', operatorProfile.companyName);

  // Create vehicles (delete and recreate for this operator)
  await prisma.vehicle.deleteMany({
    where: { operatorId: operatorProfile.id },
  });

  const vehicles = await prisma.vehicle.createMany({
    data: [
      {
        operatorId: operatorProfile.id,
        vehicleType: VehicleType.SALOON,
        registrationPlate: 'AB21CDE',
        make: 'Toyota',
        model: 'Prius',
        year: 2023,
        isActive: true,
      },
      {
        operatorId: operatorProfile.id,
        vehicleType: VehicleType.MPV,
        registrationPlate: 'AB21FGH',
        make: 'Ford',
        model: 'Galaxy',
        year: 2022,
        isActive: true,
      },
    ],
  });
  console.log('✅ Vehicles created:', vehicles.count);

  // Create service areas (delete and recreate to avoid duplicates)
  await prisma.serviceArea.deleteMany({
    where: { operatorId: operatorProfile.id },
  });

  await prisma.serviceArea.createMany({
    data: [
      { operatorId: operatorProfile.id, postcode: 'SW1A' },
      { operatorId: operatorProfile.id, postcode: 'SW1B' },
    ],
  });
  console.log('✅ Service areas created');

  // Create pricing rules (delete and recreate)
  await prisma.pricingRule.deleteMany({});

  await prisma.pricingRule.createMany({
    data: [
      {
        ruleType: 'BASE_FARE_SALOON',
        vehicleType: VehicleType.SALOON,
        baseValue: new Prisma.Decimal('15.00'),
        description: 'Base fare for Saloon vehicles',
        isActive: true,
      },
      {
        ruleType: 'BASE_FARE_MPV',
        vehicleType: VehicleType.MPV,
        baseValue: new Prisma.Decimal('25.00'),
        description: 'Base fare for MPV vehicles',
        isActive: true,
      },
      {
        ruleType: 'PER_MILE_RATE',
        baseValue: new Prisma.Decimal('1.50'),
        description: 'Cost per mile',
        isActive: true,
      },
    ],
  });
  console.log('✅ Pricing rules created');

  // Create sample one-way booking (upsert by bookingReference)
  const oneWayBooking = await prisma.booking.upsert({
    where: { bookingReference: 'TTS-ONEWAY001' },
    update: {},
    create: {
      bookingReference: 'TTS-ONEWAY001',
      customerId: customer.id,
      journeyType: JourneyType.ONE_WAY,
      pickupAddress: '123 Main Street, London',
      pickupPostcode: 'SW1A 1AA',
      pickupLat: 51.5074,
      pickupLng: -0.1278,
      dropoffAddress: 'Heathrow Airport Terminal 5',
      dropoffPostcode: 'TW6 2GA',
      dropoffLat: 51.4700,
      dropoffLng: -0.4543,
      pickupDatetime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      passengerCount: 2,
      luggageCount: 2,
      vehicleType: VehicleType.SALOON,
      serviceType: 'AIRPORT_DROPOFF',
      customerPrice: new Prisma.Decimal('45.00'),
      status: 'PAID',
    },
  });
  console.log('✅ One-way booking created/found:', oneWayBooking.bookingReference);

  // Create sample return journey (BookingGroup with 2 bookings)
  // Check if booking group exists
  let bookingGroup = await prisma.bookingGroup.findFirst({
    where: { groupReference: 'TTS-GRP-RETURN001' },
  });

  if (!bookingGroup) {
    bookingGroup = await prisma.bookingGroup.create({
      data: {
        groupReference: 'TTS-GRP-RETURN001',
        customerId: customer.id,
        totalPrice: new Prisma.Decimal('85.50'), // 90 - 5% discount
        discountType: DiscountType.RETURN_JOURNEY,
        discountAmount: new Prisma.Decimal('4.50'),
        status: 'ACTIVE',
      },
    });

    const outboundBooking = await prisma.booking.create({
      data: {
        bookingReference: 'TTS-OUT001',
        customerId: customer.id,
        journeyType: JourneyType.OUTBOUND,
        bookingGroupId: bookingGroup.id,
        pickupAddress: '456 High Street, Manchester',
        pickupPostcode: 'M1 1AA',
        pickupLat: 53.4808,
        pickupLng: -2.2426,
        dropoffAddress: 'Manchester Airport Terminal 1',
        dropoffPostcode: 'M90 1QX',
        dropoffLat: 53.3588,
        dropoffLng: -2.2727,
        pickupDatetime: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
        passengerCount: 3,
        luggageCount: 3,
        vehicleType: VehicleType.MPV,
        serviceType: 'AIRPORT_DROPOFF',
        customerPrice: new Prisma.Decimal('45.00'),
        status: 'PAID',
      },
    });

    await prisma.booking.create({
      data: {
        bookingReference: 'TTS-RET001',
        customerId: customer.id,
        journeyType: JourneyType.RETURN,
        bookingGroupId: bookingGroup.id,
        linkedBookingId: outboundBooking.id,
        pickupAddress: 'Manchester Airport Terminal 1',
        pickupPostcode: 'M90 1QX',
        pickupLat: 53.3588,
        pickupLng: -2.2727,
        dropoffAddress: '456 High Street, Manchester',
        dropoffPostcode: 'M1 1AA',
        dropoffLat: 53.4808,
        dropoffLng: -2.2426,
        pickupDatetime: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 21 days from now
        passengerCount: 3,
        luggageCount: 3,
        vehicleType: VehicleType.MPV,
        serviceType: 'AIRPORT_PICKUP',
        flightNumber: 'BA1234',
        customerPrice: new Prisma.Decimal('45.00'),
        status: 'PAID',
      },
    });
    console.log('✅ Return journey created:', bookingGroup.groupReference);
  } else {
    console.log('✅ Return journey already exists:', bookingGroup.groupReference);
  }

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
      value: 'admin@example.com',
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

  // ===== SEED CANCELLATION POLICIES =====
  console.log('📋 Seeding cancellation policies...');

  // Clear existing policies
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

  console.log('✨ Database seeding completed successfully!');
}

main()
  .catch((error) => {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

