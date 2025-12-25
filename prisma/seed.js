"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🌱 Starting database seeding...');
    // Create admin user
    const adminPassword = await bcrypt.hash('Admin@123456', 10);
    const admin = await prisma.user.create({
        data: {
            email: 'admin@example.com',
            password: adminPassword,
            firstName: 'Admin',
            lastName: 'User',
            role: client_1.UserRole.ADMIN,
            isEmailVerified: true,
            isActive: true,
        },
    });
    console.log('✅ Admin user created:', admin.email);
    // Create sample customer
    const customerPassword = await bcrypt.hash('Customer@123456', 10);
    const customer = await prisma.user.create({
        data: {
            email: 'customer@example.com',
            password: customerPassword,
            firstName: 'John',
            lastName: 'Doe',
            phoneNumber: '+441234567890',
            role: client_1.UserRole.CUSTOMER,
            isEmailVerified: true,
            isActive: true,
        },
    });
    console.log('✅ Customer user created:', customer.email);
    // Create sample operator
    const operatorPassword = await bcrypt.hash('Operator@123456', 10);
    const operator = await prisma.user.create({
        data: {
            email: 'operator@example.com',
            password: operatorPassword,
            firstName: 'Jane',
            lastName: 'Smith',
            phoneNumber: '+441234567891',
            role: client_1.UserRole.OPERATOR,
            isEmailVerified: true,
            isActive: true,
        },
    });
    console.log('✅ Operator user created:', operator.email);
    // Create operator profile
    const operatorProfile = await prisma.operatorProfile.create({
        data: {
            userId: operator.id,
            companyName: 'Premium Transfers Ltd',
            registrationNumber: 'REG123456',
            vatNumber: 'VAT123456789',
            isApproved: true,
            reputationScore: new client_1.Prisma.Decimal('4.8'),
        },
    });
    console.log('✅ Operator profile created:', operatorProfile.companyName);
    // Create vehicles
    const vehicle1 = await prisma.vehicle.create({
        data: {
            operatorId: operatorProfile.id,
            vehicleType: client_1.VehicleType.SALOON,
            registrationPlate: 'AB21CDE',
            make: 'Toyota',
            model: 'Prius',
            year: 2023,
            isActive: true,
        },
    });
    const vehicle2 = await prisma.vehicle.create({
        data: {
            operatorId: operatorProfile.id,
            vehicleType: client_1.VehicleType.MPV,
            registrationPlate: 'AB21FGH',
            make: 'Ford',
            model: 'Galaxy',
            year: 2022,
            isActive: true,
        },
    });
    console.log('✅ Vehicles created:', vehicle1.registrationPlate, vehicle2.registrationPlate);
    // Create service areas
    await prisma.serviceArea.create({
        data: {
            operatorId: operatorProfile.id,
            postcode: 'SW1A',
        },
    });
    await prisma.serviceArea.create({
        data: {
            operatorId: operatorProfile.id,
            postcode: 'SW1B',
        },
    });
    console.log('✅ Service areas created');
    // Create pricing rules
    await prisma.pricingRule.create({
        data: {
            ruleType: 'BASE_FARE_SALOON',
            vehicleType: client_1.VehicleType.SALOON,
            baseValue: new client_1.Prisma.Decimal('15.00'),
            description: 'Base fare for Saloon vehicles',
            isActive: true,
        },
    });
    await prisma.pricingRule.create({
        data: {
            ruleType: 'BASE_FARE_MPV',
            vehicleType: client_1.VehicleType.MPV,
            baseValue: new client_1.Prisma.Decimal('25.00'),
            description: 'Base fare for MPV vehicles',
            isActive: true,
        },
    });
    await prisma.pricingRule.create({
        data: {
            ruleType: 'PER_MILE_RATE',
            baseValue: new client_1.Prisma.Decimal('1.50'),
            description: 'Cost per mile',
            isActive: true,
        },
    });
    console.log('✅ Pricing rules created');
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
//# sourceMappingURL=seed.js.map