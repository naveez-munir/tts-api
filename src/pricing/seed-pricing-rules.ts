import { DataSource } from 'typeorm';
import { PricingRule, PricingRuleType } from './entities/pricing-rule.entity';
import { VehicleType } from '../common/enums';

/**
 * Seed default pricing rules
 * Run with: npx ts-node src/pricing/seed-pricing-rules.ts
 */
export async function seedPricingRules(dataSource: DataSource): Promise<void> {
  const pricingRuleRepo = dataSource.getRepository(PricingRule);

  // Check if rules already exist
  const existingCount = await pricingRuleRepo.count();
  if (existingCount > 0) {
    console.log('Pricing rules already exist. Skipping seed.');
    return;
  }

  const rules: Partial<PricingRule>[] = [
    // Base fares by vehicle type
    {
      ruleType: PricingRuleType.BASE_FARE,
      vehicleType: VehicleType.SALOON,
      baseAmount: 5.0,
      description: 'Base fare for Saloon',
    },
    {
      ruleType: PricingRuleType.BASE_FARE,
      vehicleType: VehicleType.ESTATE,
      baseAmount: 7.0,
      description: 'Base fare for Estate',
    },
    {
      ruleType: PricingRuleType.BASE_FARE,
      vehicleType: VehicleType.MPV,
      baseAmount: 10.0,
      description: 'Base fare for MPV/People Carrier',
    },
    {
      ruleType: PricingRuleType.BASE_FARE,
      vehicleType: VehicleType.EXECUTIVE,
      baseAmount: 15.0,
      description: 'Base fare for Executive',
    },
    {
      ruleType: PricingRuleType.BASE_FARE,
      vehicleType: VehicleType.MINIBUS,
      baseAmount: 25.0,
      description: 'Base fare for Minibus',
    },

    // Per-mile rates by vehicle type
    {
      ruleType: PricingRuleType.PER_MILE,
      vehicleType: VehicleType.SALOON,
      baseAmount: 2.0,
      description: 'Per mile rate for Saloon',
    },
    {
      ruleType: PricingRuleType.PER_MILE,
      vehicleType: VehicleType.ESTATE,
      baseAmount: 2.5,
      description: 'Per mile rate for Estate',
    },
    {
      ruleType: PricingRuleType.PER_MILE,
      vehicleType: VehicleType.MPV,
      baseAmount: 3.0,
      description: 'Per mile rate for MPV/People Carrier',
    },
    {
      ruleType: PricingRuleType.PER_MILE,
      vehicleType: VehicleType.EXECUTIVE,
      baseAmount: 4.0,
      description: 'Per mile rate for Executive',
    },
    {
      ruleType: PricingRuleType.PER_MILE,
      vehicleType: VehicleType.MINIBUS,
      baseAmount: 5.0,
      description: 'Per mile rate for Minibus',
    },

    // Time surcharge (night rate 22:00-06:00)
    {
      ruleType: PricingRuleType.TIME_SURCHARGE,
      baseAmount: 0,
      percentage: 20.0,
      startTime: '22:00',
      endTime: '06:00',
      description: 'Night rate (22:00-06:00)',
    },

    // Meet and Greet fee
    {
      ruleType: PricingRuleType.MEET_AND_GREET,
      baseAmount: 10.0,
      description: 'Meet & Greet service fee',
    },

    // Airport fees
    {
      ruleType: PricingRuleType.AIRPORT_FEE,
      airportCode: 'LHR',
      baseAmount: 5.0,
      description: 'London Heathrow airport fee',
    },
    {
      ruleType: PricingRuleType.AIRPORT_FEE,
      airportCode: 'LGW',
      baseAmount: 4.0,
      description: 'London Gatwick airport fee',
    },
    {
      ruleType: PricingRuleType.AIRPORT_FEE,
      airportCode: 'STN',
      baseAmount: 3.0,
      description: 'London Stansted airport fee',
    },
    {
      ruleType: PricingRuleType.AIRPORT_FEE,
      airportCode: 'LTN',
      baseAmount: 3.0,
      description: 'London Luton airport fee',
    },
    {
      ruleType: PricingRuleType.AIRPORT_FEE,
      airportCode: 'MAN',
      baseAmount: 4.0,
      description: 'Manchester airport fee',
    },
    {
      ruleType: PricingRuleType.AIRPORT_FEE,
      airportCode: 'BHX',
      baseAmount: 3.0,
      description: 'Birmingham airport fee',
    },

    // Holiday surcharge (Christmas/New Year) - set dates for current year
    {
      ruleType: PricingRuleType.HOLIDAY_SURCHARGE,
      baseAmount: 0,
      percentage: 50.0,
      startDate: new Date('2025-12-24'),
      endDate: new Date('2026-01-02'),
      description: 'Christmas and New Year surcharge (50%)',
    },
  ];

  for (const rule of rules) {
    const entity = pricingRuleRepo.create(rule);
    await pricingRuleRepo.save(entity);
  }

  console.log(`Seeded ${rules.length} pricing rules.`);
}

// Standalone execution
if (require.main === module) {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS,
    database: process.env.DB_NAME || 'tts_api',
    entities: [PricingRule],
    synchronize: false,
  });

  dataSource
    .initialize()
    .then(() => seedPricingRules(dataSource))
    .then(() => dataSource.destroy())
    .catch((err) => {
      console.error('Error seeding pricing rules:', err);
      process.exit(1);
    });
}
