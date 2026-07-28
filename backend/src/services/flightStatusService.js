/**
 * Flight service — MOCK implementation.
 * No Amadeus calls. Returns data from mockData.js.
 *
 * Search logic:
 *  - Looks up MOCK_FLIGHTS["FROM-TO"]
 *  - Filters by date offset (all flights are pinned to today+3 but
 *    we accept any valid date so the UI never gets zero results)
 *  - Applies adults multiplier to prices
 *  - Honours nonStop filter
 *  - Falls back to reversed route or a generic set if route not found
 */

const cache = require('../config/cache');
const logger = require('../config/logger');

/**
 * Get status for a specific flight by carrier and flight number.
 */
async function getFlightStatus({ carrierCode = 'BA', flightNumber, scheduledDepartureDate }) {
  if (!flightNumber) {
    throw Object.assign(new Error('flightNumber is required'), { statusCode: 400 });
  }

  const cleanNum = flightNumber.toString().replace(/^BA-?/i, '');
  const key = `${carrierCode.toUpperCase()}${cleanNum}:${scheduledDepartureDate || 'today'}`;
  logger.info('[flightStatusService] getFlightStatus', { carrierCode, flightNumber: cleanNum, scheduledDepartureDate });

  const cached = cache.get(`status:${key}`);
  if (cached) return cached;

  // Mock status generator for BA flights
  const statusList = ['ON_TIME', 'ON_TIME', 'ON_TIME', 'BOARDING', 'SCHEDULED', 'DEPARTED'];
  const statusIndex = Math.abs((cleanNum.charCodeAt(0) || 0) + parseInt(cleanNum, 10) || 1) % statusList.length;
  const statusStr = statusList[statusIndex];

  const departureDateStr = scheduledDepartureDate || new Date().toISOString().split('T')[0];

  const result = {
    flightNumber: `${carrierCode.toUpperCase()}${cleanNum}`,
    carrier: 'British Airways',
    status: statusStr,
    departure: {
      airport: 'LHR',
      terminal: '5',
      gate: 'B36',
      scheduledTime: `${departureDateStr}T10:15:00Z`,
      estimatedTime: `${departureDateStr}T10:15:00Z`,
    },
    arrival: {
      airport: 'JFK',
      terminal: '7',
      gate: '12',
      scheduledTime: `${departureDateStr}T13:45:00Z`,
      estimatedTime: `${departureDateStr}T13:45:00Z`,
    },
    aircraft: 'Boeing 777-300ER',
  };

  cache.set(`status:${key}`, result, 120);
  return result;
}

/**
 * Get flight status list for a specific origin and destination route.
 */
async function getFlightsByRoute({ origin, destination, departureDate }) {
  if (!origin || !destination) {
    throw Object.assign(new Error('origin and destination are required'), { statusCode: 400 });
  }

  const depDate = departureDate || new Date().toISOString().split('T')[0];
  logger.info('[flightStatusService] getFlightsByRoute', { origin, destination, departureDate: depDate });

  const flights = [
    {
      flightNumber: 'BA117',
      carrier: 'British Airways',
      status: 'ON_TIME',
      departure: { airport: origin, terminal: '5', scheduledTime: `${depDate}T08:25:00Z` },
      arrival: { airport: destination, terminal: '7', scheduledTime: `${depDate}T11:15:00Z` },
    },
    {
      flightNumber: 'BA175',
      carrier: 'British Airways',
      status: 'ON_TIME',
      departure: { airport: origin, terminal: '5', scheduledTime: `${depDate}T13:40:00Z` },
      arrival: { airport: destination, terminal: '7', scheduledTime: `${depDate}T16:30:00Z` },
    },
    {
      flightNumber: 'BA204',
      carrier: 'British Airways',
      status: 'SCHEDULED',
      departure: { airport: origin, terminal: '5', scheduledTime: `${depDate}T18:00:00Z` },
      arrival: { airport: destination, terminal: '7', scheduledTime: `${depDate}T20:50:00Z` },
    },
  ];

  return { origin, destination, date: depDate, count: flights.length, flights };
}

module.exports = { getFlightStatus, getFlightsByRoute };