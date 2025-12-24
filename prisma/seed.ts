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

