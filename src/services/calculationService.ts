import { ConsumerCategory, BillCalculation } from '../types';

interface TariffRate {
  minCharge: number; // for first 10 cu.m.
  tier11_20: number; // 11-20 cu.m.
  tier21_30: number; // 21-30 cu.m.
  tier31_40: number; // 31-40 cu.m.
  tier41_up: number; // 41+ cu.m.
}

const TARIFF_SCHEDULE: Record<ConsumerCategory, TariffRate> = {
  Residential: {
    minCharge: 215.00,
    tier11_20: 23.50,
    tier21_30: 26.80,
    tier31_40: 31.20,
    tier41_up: 36.50,
  },
  'Commercial A': {
    minCharge: 430.00,
    tier11_20: 47.00,
    tier21_30: 53.60,
    tier31_40: 62.40,
    tier41_up: 73.00,
  },
  'Commercial B': {
    minCharge: 376.25,
    tier11_20: 41.10,
    tier21_30: 46.90,
    tier31_40: 54.60,
    tier41_up: 63.85,
  },
  Industrial: {
    minCharge: 537.50,
    tier11_20: 58.75,
    tier21_30: 67.00,
    tier31_40: 78.00,
    tier41_up: 91.25,
  },
  Institutional: {
    minCharge: 268.75,
    tier11_20: 29.35,
    tier21_30: 33.50,
    tier31_40: 39.00,
    tier41_up: 45.60,
  },
};

export class CalculationService {
  /**
   * Computes the full water bill according to LWUA & Tagoloan Water District tariff schedules.
   */
  static calculateWaterBill(
    category: ConsumerCategory,
    previousReading: number,
    currentReading: number,
    readingDateString?: string
  ): BillCalculation {
    const consumption = Math.max(0, currentReading - previousReading);
    const tariff = TARIFF_SCHEDULE[category] || TARIFF_SCHEDULE.Residential;

    const breakdown: BillCalculation['breakdown'] = [];
    let commodityCharge = 0;

    // Minimum charge covers 0 - 10 cu.m.
    const minCuM = Math.min(consumption, 10);
    const minCharge = tariff.minCharge;
    breakdown.push({
      bracket: 'First 10 cu.m. (Min. Charge)',
      cuM: minCuM,
      ratePerCuM: minCharge / 10,
      amount: minCharge,
    });

    if (consumption > 10) {
      // Tier 11 - 20
      const tier1CuM = Math.min(Math.max(0, consumption - 10), 10);
      if (tier1CuM > 0) {
        const amt = tier1CuM * tariff.tier11_20;
        commodityCharge += amt;
        breakdown.push({
          bracket: '11 - 20 cu.m.',
          cuM: tier1CuM,
          ratePerCuM: tariff.tier11_20,
          amount: amt,
        });
      }

      // Tier 21 - 30
      const tier2CuM = Math.min(Math.max(0, consumption - 20), 10);
      if (tier2CuM > 0) {
        const amt = tier2CuM * tariff.tier21_30;
        commodityCharge += amt;
        breakdown.push({
          bracket: '21 - 30 cu.m.',
          cuM: tier2CuM,
          ratePerCuM: tariff.tier21_30,
          amount: amt,
        });
      }

      // Tier 31 - 40
      const tier3CuM = Math.min(Math.max(0, consumption - 30), 10);
      if (tier3CuM > 0) {
        const amt = tier3CuM * tariff.tier31_40;
        commodityCharge += amt;
        breakdown.push({
          bracket: '31 - 40 cu.m.',
          cuM: tier3CuM,
          ratePerCuM: tariff.tier31_40,
          amount: amt,
        });
      }

      // Tier 41+
      const tier4CuM = Math.max(0, consumption - 40);
      if (tier4CuM > 0) {
        const amt = tier4CuM * tariff.tier41_up;
        commodityCharge += amt;
        breakdown.push({
          bracket: '41 cu.m. & above',
          cuM: tier4CuM,
          ratePerCuM: tariff.tier41_up,
          amount: amt,
        });
      }
    }

    const subTotal = minCharge + commodityCharge;
    const environmentalFee = Number((subTotal * 0.05).toFixed(2)); // 5% Environmental / Watershed fee
    const franchiseTax = Number((subTotal * 0.02).toFixed(2)); // 2% Local franchise tax
    const maintenanceFee = 10.00; // Fixed meter maintenance
    const seniorDiscount = 0.00; // Can be set if qualified

    const totalAmountDue = Number(
      (subTotal + environmentalFee + franchiseTax + maintenanceFee - seniorDiscount).toFixed(2)
    );

    const penaltyAfterDue = Number((subTotal * 0.10).toFixed(2)); // 10% on basic charges
    const grossAmountAfterDue = Number((totalAmountDue + penaltyAfterDue).toFixed(2));

    // Dates
    const baseDate = readingDateString ? new Date(readingDateString) : new Date();
    const billingPeriod = `${baseDate.toLocaleString('default', { month: 'short' })} 01 - ${baseDate.toLocaleString('default', { month: 'short' })} ${baseDate.getDate()}, ${baseDate.getFullYear()}`;

    const dueDateObj = new Date(baseDate);
    dueDateObj.setDate(dueDateObj.getDate() + 15);
    const dueDate = dueDateObj.toISOString().split('T')[0];

    const disconnDateObj = new Date(dueDateObj);
    disconnDateObj.setDate(disconnDateObj.getDate() + 5);
    const disconnectionDate = disconnDateObj.toISOString().split('T')[0];

    return {
      consumption,
      minimumCharge: minCharge,
      commodityCharge: Number(commodityCharge.toFixed(2)),
      breakdown,
      subTotal: Number(subTotal.toFixed(2)),
      environmentalFee,
      franchiseTax,
      maintenanceFee,
      seniorDiscount,
      totalAmountDue,
      penaltyAfterDue,
      grossAmountAfterDue,
      billingPeriod,
      dueDate,
      disconnectionDate,
    };
  }

  /**
   * Validates if consumption is abnormal compared to historical average.
   */
  static checkConsumptionAnomaly(
    consumption: number,
    averageConsumption: number
  ): { isAnomaly: boolean; reason?: string } {
    if (consumption === 0) {
      return {
        isAnomaly: true,
        reason: 'Zero consumption recorded (Verify if house is unoccupied or meter is stuck).',
      };
    }
    if (averageConsumption > 0 && consumption >= averageConsumption * 2.2) {
      return {
        isAnomaly: true,
        reason: `High consumption alert: ${consumption} cu.m. is >220% of 3-month average (${averageConsumption} cu.m.). Check for underground leaks or high-volume usage.`,
      };
    }
    if (averageConsumption > 15 && consumption <= averageConsumption * 0.3) {
      return {
        isAnomaly: true,
        reason: `Substantially low consumption: ${consumption} cu.m. vs ${averageConsumption} cu.m. average. Check for meter slowdown.`,
      };
    }
    return { isAnomaly: false };
  }
}
