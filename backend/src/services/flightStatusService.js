/**
 * Flight status service — MOCK implementation.
 * No Amadeus calls. Matches flight numbers against MOCK_STATUSES.
 *
 * By flight number: exact match on flightNumber field.
 * By route: match departure/arrival IATA codes from the route string.
 * Unknown flight: returns a plausible "Scheduled" record.
 */

const cache = require('../config/cache');
const logger = require('../config/logger');
const { MOCK_STATUSES } = require('../mocks/mockData');

async function getFlightStatus({ carrierCode, flightNumber, scheduledDepartureDate }) {
  const fn = `${carrierCode}${flightNumber}`.toUpperCase();
  const cacheKey = `status:${fn}:${scheduledDepartureDate}`;

  const cached = cache.get(cacheKey);
  if (cached) return cached;

  logger.info('[MOCK] Flight status lookup', { fn });

  const match = MOCK_STATUSES.find(
    s => s.flightNumber.toUpperCase() === fn
  );

  const result = [match || buildUnknownStatus(fn)];
  cache.set(cacheKey, result, 60);
  return result;
}

async function getFlightsByRoute({ origin, destination, departureDate }) {
  const cacheKey = `route-status:${origin}-${destination}:${departureDate}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  logger.info('[MOCK] Flights by route for status', { origin, destination });

  const matches = MOCK_STATUSES.filter(s => {
    const [dep, arr] = s.route.split(' → ');
    return (
      dep.trim().toUpperCase() === origin.toUpperCase() &&
      arr.trim().toUpperCase() === destination.toUpperCase()
    );
  });

  // If no exact route match, return first 3 statuses as fallback
  const result = matches.length > 0 ? matches : MOCK_STATUSES.slice(0, 3);
  cache.set(cacheKey, result, 120);
  return result;
}

function buildUnknownStatus(flightNumber) {
  return {
    flightNumber,
    route: 'LHR → ???',
    scheduledDep: '--:--',
    actualDep:    '--:--',
    scheduledArr: '--:--',
    actualArr:    '--:--',
    status: 'scheduled',
    statusLabel: 'Scheduled',
    gate: 'TBD',
    terminal: '5',
    aircraft: 'Unknown',
    progress: 0,
  };
}

module.exports = { getFlightStatus, getFlightsByRoute };
