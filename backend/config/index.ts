/**
 * Tagoloan Water District (WDT) - Backend Application Configuration
 */

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  env: process.env.NODE_ENV || 'development',
  districtName: 'Tagoloan Water District',
  districtCode: 'WDT-MISOR',
  lwuaRates: {
    residential: {
      minimumCharge: 210.0, // 0 to 10 cu.m
      tier1: 22.5,          // 11 to 20 cu.m
      tier2: 24.5,          // 21 to 30 cu.m
      tier3: 27.0,          // 31+ cu.m
    },
    commercial: {
      minimumCharge: 420.0,
      tier1: 45.0,
      tier2: 49.0,
      tier3: 54.0,
    },
  },
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    headers: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  },
};
