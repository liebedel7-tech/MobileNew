/**
 * Tagoloan Water District (WDT) - Billing Service
 * Implements the official LWUA-approved tiered volumetric water rate tariff.
 */

import { config } from '../config';
import { BillingComputationResult } from '../models/Billing';

export class BillingService {
  /**
   * Computes tiered water bill based on consumption volume (cu.m)
   */
  public static calculateBill(consumption: number, category: string = 'Residential'): BillingComputationResult {
    const isCommercial = category.toLowerCase().includes('commercial');
    const rates = isCommercial ? config.lwuaRates.commercial : config.lwuaRates.residential;

    const minCharge = rates.minimumCharge; // covers first 10 cu.m
    let tier1Amount = 0;
    let tier2Amount = 0;
    let tier3Amount = 0;

    if (consumption > 10) {
      const tier1Vol = Math.min(Math.max(consumption - 10, 0), 10);
      tier1Amount = tier1Vol * rates.tier1;
    }

    if (consumption > 20) {
      const tier2Vol = Math.min(Math.max(consumption - 20, 0), 10);
      tier2Amount = tier2Vol * rates.tier2;
    }

    if (consumption > 30) {
      const tier3Vol = Math.max(consumption - 30, 0);
      tier3Amount = tier3Vol * rates.tier3;
    }

    const totalAmount = Math.round((minCharge + tier1Amount + tier2Amount + tier3Amount) * 100) / 100;

    // Calculate due date (standard 15 calendar days from billing date)
    const due = new Date();
    due.setDate(due.getDate() + 15);
    const dueDateStr = due.toISOString().split('T')[0];

    return {
      consumption,
      minimumCharge: minCharge,
      tier1Amount,
      tier2Amount,
      tier3Amount,
      totalAmount,
      dueDate: dueDateStr,
      rateCategory: category,
    };
  }

  /**
   * Detects abnormal consumption spikes or drops
   */
  public static detectAnomaly(currentConsumption: number, averageConsumption: number): { isAnomaly: boolean; anomalyType?: string } {
    if (currentConsumption < 0) {
      return { isAnomaly: true, anomalyType: 'NEGATIVE_CONSUMPTION' };
    }
    if (averageConsumption > 0 && currentConsumption >= averageConsumption * 2.5) {
      return { isAnomaly: true, anomalyType: 'HIGH_CONSUMPTION' };
    }
    if (currentConsumption === 0 && averageConsumption > 5) {
      return { isAnomaly: true, anomalyType: 'ZERO_CONSUMPTION' };
    }
    return { isAnomaly: false };
  }
}
