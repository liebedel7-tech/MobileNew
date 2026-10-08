/**
 * Tagoloan Water District (WDT) - Backend Test & Verification Runner
 * Validates LWUA tiered rate calculations and anomaly detection.
 */

import { BillingService } from '../services/billingService';
import { db } from '@/database/db';

export function runBackendDiagnostics() {
  const tests: Array<{ name: string; passed: boolean; details?: string }> = [];

  // Test 1: Minimum charge for <= 10 cu.m
  const res1 = BillingService.calculateBill(8, 'Residential');
  tests.push({
    name: 'Calculates minimum charge for 10 cu.m and below',
    passed: res1.totalAmount === 210.0 && res1.consumption === 8,
  });

  // Test 2: Tier 1 Volumetric surcharge
  const res2 = BillingService.calculateBill(15, 'Residential');
  tests.push({
    name: 'Calculates Block 1 (11-20 cu.m) tiered surcharge',
    passed: res2.totalAmount === 322.5,
  });

  // Test 3: High consumption anomaly detection
  const anomaly = BillingService.detectAnomaly(60, 18);
  tests.push({
    name: 'Detects abnormally high consumption spikes',
    passed: anomaly.isAnomaly === true && anomaly.anomalyType === 'HIGH_CONSUMPTION',
  });

  // Test 4: Database seed accessibility
  const consumers = db.getConsumers();
  const readers = db.getReaders();
  tests.push({
    name: 'Database has pre-seeded consumers and readers',
    passed: consumers.length > 0 && readers.length > 0,
  });

  return tests;
}
