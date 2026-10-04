export const APP_CONFIG = {
  planner: {
    maxRadiusKm: 30,
    defaultMode: 'walk',
    defaultTopN: 5,
    timeBudgets: { '2h': 120, '4h': 240, '6h': 360 },
    trafficBuffer: 0.20,
    defaultDwellMinutes: 15,
  },
  speeds: {
    walking: 5,
    bike: 15,
    car: 20,
  },
  checkIn: {
    cooldownMinutes: 120,
    defaultRadiusMeters: 120,
  },
};
