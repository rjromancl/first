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
const { MOCK_FLIGHTS } = require('../mocks/mockData');

const CABIN_PRICE_KEY = {
  ECONOMY: 'economy',
  PREMIUM_ECONOMY: 'premiumEconomy',
  BUSINESS: 'businessClass',
  FIRST: 'firstClass',
};

async function searchFlights({
  originLocationCode,
  destinationLocationCode,
  departureDate,
  returnDate,
  adults = 1,
  travelClass = 'ECONOMY',
  nonStop = false,
  currencyCode = 'GBP',
}) {
  if (!originLocationCode || !destinationLocationCode) {
    throw Object.assign(
      new Error('searchFlights: originLocationCode and destinationLocationCode are required'),
      { statusCode: 400 }
    );
  }

  const numAdults = parseInt(adults, 10);
  if (!Number.isInteger(numAdults) || numAdults < 1) {
    throw Object.assign(new Error('searchFlights: adults must be a positive integer'), {
      statusCode: 400,
    });
  }

  const origin = originLocationCode.toUpperCase();
  const destination = destinationLocationCode.toUpperCase();
  const key = `${origin}-${destination}`;
  const cacheKey = `flights:${key}:${departureDate}:${numAdults}:${travelClass}`;

  const cached = cache.get(cacheKey);
  if (cached) {
    logger.debug('Flight search cache hit', { cacheKey });
    return cached;
  }

  logger.info('[MOCK] Flight search', { key, departureDate, adults: numAdults, travelClass });

  // Find flights for route — try forward, reverse, then first available
  const base =
    MOCK_FLIGHTS[key] ||
    MOCK_FLIGHTS[`${destination}-${origin}`] ||
    Object.values(MOCK_FLIGHTS)[0];

  if (!base || base.length === 0) {
    throw Object.assign(new Error('searchFlights: no mock flight data is configured'), {
      statusCode: 500,
    });
  }

  const cabinKey = CABIN_PRICE_KEY[travelClass] || 'economy';

  // Clone and pin to requested departure date
  let flights = base.map((f) => {
    const clone = JSON.parse(JSON.stringify(f));
    clone.date = departureDate || clone.date;

    // Re-stamp segment dates to requested date
    if (clone.itineraries?.[0]?.segments) {
      clone.itineraries[0].segments = clone.itineraries[0].segments.map((seg) => ({
        ...seg,
        departure: { ...seg.departure, at: `${clone.date}T${seg.departure.at.substring(11)}` },
        arrival: { ...seg.arrival, at: `${clone.date}T${seg.arrival.at.substring(11)}` },
      }));
    }

    // Price for the requested cabin class, scaled by passenger count.
    // Falls back to the flight's base grandTotal if no per-cabin price exists.
    const rawCabinPrice = clone.prices?.[cabinKey];
    const unitPrice = rawCabinPrice != null ? parseFloat(rawCabinPrice) : parseFloat(clone.price?.grandTotal);

    if (Number.isNaN(unitPrice)) {
      logger.warn('[flightService] Missing price data for flight', { flightId: clone.id, cabinKey });
    }

    const total = (Number.isNaN(unitPrice) ? 0 : unitPrice * numAdults).toFixed(2);
    clone.price = { grandTotal: total, total, currency: currencyCode };

    return clone;
  });

  // Apply nonStop filter
  if (nonStop === true || nonStop === 'true') {
    const direct = flights.filter((f) => f.stops === 0);
    if (direct.length > 0) flights = direct;
  }

  const result = {
    flights,
    dictionaries: {},
    meta: { count: flights.length },
  };

  cache.set(cacheKey, result, 300);
  return result;
}

async function confirmFlightPrice(flightOffer) {
  if (!flightOffer) {
    throw Object.assign(new Error('confirmFlightPrice: flightOffer is required'), {
      statusCode: 400,
    });
  }
  // In mock mode just echo back the offer — no Amadeus pricing call needed
  logger.info('[MOCK] confirmFlightPrice — echoing offer back');
  return { flightOffers: [flightOffer] };
}

module.exports = { searchFlights, confirmFlightPrice };