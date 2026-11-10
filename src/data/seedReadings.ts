import { MeterReading, ConsumerCategory } from '../types';
import { INITIAL_CONSUMERS } from './seedData';
import { CalculationService } from '../services/calculationService';

/**
 * Generates verified historical readings for Tagoloan Water District consumers
 * spanning past cycles (October 2026, September 2026, August 2026).
 * 
 * Provides an authoritative historical ledger so when field readers click on an account,
 * they immediately see all past readings for previous months, years, or days.
 */
export function generateSeedHistoricalReadings(): MeterReading[] {
  const readings: MeterReading[] = [];

  INITIAL_CONSUMERS.forEach((consumer) => {
    // Only generate history for issued consumer accounts
    if (!consumer.accountNumber || consumer.accountNumber.startsWith('PENDING')) {
      return;
    }

    const baseline = Number(consumer.previousReading || 0);
    const avg = Number(consumer.averageConsumption || 16);
    const category = (consumer.category || 'Residential') as ConsumerCategory;
    const barangay = consumer.barangay || 'Poblacion';
    const routeCode = consumer.routeCode || 'RT-01';

    // Cycle 1: October 2026 (The immediate previous baseline)
    const cons1 = Number(consumer.previousConsumption || Math.max(10, avg));
    // If consumer initial index is 0, give realistic meter readings (prev = 100, curr = 100 + cons1)
    // so PREVIOUS and PRESENT are not both 00000 cu.m. when consumption is +19 cu.m.
    let curr1 = baseline;
    let prev1 = Math.max(0, curr1 - cons1);
    if (baseline === 0) {
      prev1 = 80;
      curr1 = prev1 + cons1;
    }
    const date1 = '2026-10-25';
    const bill1 = CalculationService.calculateWaterBill(category, prev1, curr1, date1);

    readings.push({
      id: `READ-HIST-${consumer.accountNumber}-202610`,
      consumerId: consumer.id,
      accountNumber: consumer.accountNumber,
      consumerName: consumer.name,
      meterSerial: consumer.meterSerial || consumer.meterNumber || 'MTR-TAG',
      meterNumber: consumer.meterNumber || consumer.meterSerial || 'MTR-TAG',
      category,
      barangay,
      routeCode,
      previousReading: prev1,
      currentReading: curr1,
      consumption: cons1,
      readingDate: date1,
      readingTime: '09:30 AM',
      readerId: 'RDR-001',
      readerName: 'Senior Field Reader',
      status: 'APPROVED',
      approvalStatus: 'approved',
      approvedBy: 'Admin Billing Supervisor',
      approvedAt: `${date1}T14:00:00Z`,
      billCalculation: bill1,
      meterCondition: 'NORMAL',
      remarks: 'Verified regular monthly cycle reading',
      gpsCoordinates: consumer.gpsCoordinates,
    });

    // Cycle 2: September 2026
    const cons2 = Math.max(8, Math.round(avg * 0.95));
    const curr2 = prev1;
    const prev2 = Math.max(0, curr2 - cons2);
    const date2 = '2026-09-24';
    const bill2 = CalculationService.calculateWaterBill(category, prev2, curr2, date2);

    readings.push({
      id: `READ-HIST-${consumer.accountNumber}-202609`,
      consumerId: consumer.id,
      accountNumber: consumer.accountNumber,
      consumerName: consumer.name,
      meterSerial: consumer.meterSerial || consumer.meterNumber || 'MTR-TAG',
      meterNumber: consumer.meterNumber || consumer.meterSerial || 'MTR-TAG',
      category,
      barangay,
      routeCode,
      previousReading: prev2,
      currentReading: curr2,
      consumption: cons2,
      readingDate: date2,
      readingTime: '10:15 AM',
      readerId: 'RDR-001',
      readerName: 'Senior Field Reader',
      status: 'APPROVED',
      approvalStatus: 'approved',
      approvedBy: 'Admin Billing Supervisor',
      approvedAt: `${date2}T15:30:00Z`,
      billCalculation: bill2,
      meterCondition: 'NORMAL',
      remarks: 'Verified regular monthly cycle reading',
      gpsCoordinates: consumer.gpsCoordinates,
    });

    // Cycle 3: August 2026
    const cons3 = Math.max(8, Math.round(avg * 1.05));
    const curr3 = prev2;
    const prev3 = Math.max(0, curr3 - cons3);
    const date3 = '2026-08-25';
    const bill3 = CalculationService.calculateWaterBill(category, prev3, curr3, date3);

    readings.push({
      id: `READ-HIST-${consumer.accountNumber}-202608`,
      consumerId: consumer.id,
      accountNumber: consumer.accountNumber,
      consumerName: consumer.name,
      meterSerial: consumer.meterSerial || consumer.meterNumber || 'MTR-TAG',
      meterNumber: consumer.meterNumber || consumer.meterSerial || 'MTR-TAG',
      category,
      barangay,
      routeCode,
      previousReading: prev3,
      currentReading: curr3,
      consumption: cons3,
      readingDate: date3,
      readingTime: '08:45 AM',
      readerId: 'RDR-002',
      readerName: 'Field Inspector',
      status: 'APPROVED',
      approvalStatus: 'approved',
      approvedBy: 'Admin Billing Supervisor',
      approvedAt: `${date3}T16:00:00Z`,
      billCalculation: bill3,
      meterCondition: 'NORMAL',
      remarks: 'Verified regular monthly cycle reading',
      gpsCoordinates: consumer.gpsCoordinates,
    });
  });

  return readings;
}

export const SEED_HISTORICAL_READINGS = generateSeedHistoricalReadings();
