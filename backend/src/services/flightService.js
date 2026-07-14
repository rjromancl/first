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
  const key = `${originLocationCode.toUpperCase()}-${destinationLocationCode.toUpperCase()}`;
  const cacheKey = `flights:${key}:${departureDate}:${adults}:${travelClass}`;

  const cached = cache.get(cacheKey);
  if (cached) {
    logger.debug('Flight search cache hit', { cacheKey });
    return cached;
  }

  logger.info('[MOCK] Flight search', { key, departureDate, adults, travelClass });

  // Find flights for route — try forward, reverse, then first available
  let base = MOCK_FLIGHTS[key]
    || MOCK_FLIGHTS[`${destinationLocationCode}-${originLocationCode}`]
    || Object.values(MOCK_FLIGHTS)[0];

  // Clone and pin to requested departure date
  let flights = base.map(f => {
    const clone = JSON.parse(JSON.stringify(f));
    clone.date = departureDate || clone.date;

    // Re-stamp segment dates to requested date
    if (clone.itineraries?.[0]?.segments) {
      clone.itineraries[0].segments = clone.itineraries[0].segments.map(seg => ({
        ...seg,
        departure: { ...seg.departure, at: `${clone.date}T${seg.departure.at.substring(11)}` },
        arrival:   { ...seg.arrival,   at: `${clone.date}T${seg.arrival.at.substring(11)}`   },
      }));
    }

    // Scale price by passenger count
    const basePrice = parseFloat(clone.price.grandTotal);
    const total = (basePrice * adults).toFixed(2);
    clone.price = { grandTotal: total, total, currency: currencyCode };

    // Cabin-class price
    const cabinKey = { ECONOMY:'economy', PREMIUM_ECONOMY:'premiumEconomy', BUSINESS:'businessClass', FIRST:'firstClass' }[travelClass] || 'economy';
    const cabinPrice = (clone.prices[cabinKey] * adults).toFixed(2);
    clone.price.grandTotal = cabinPrice;
    clone.price.total = cabinPrice;

    return clone;
  });

  // Apply nonStop filter
  if (nonStop === true || nonStop === 'true') {
    const direct = flights.filter(f => f.stops === 0);
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
  // In mock mode just echo back the offer — no Amadeus pricing call needed
  logger.info('[MOCK] confirmFlightPrice — echoing offer back');
  return { flightOffers: [flightOffer] };
}

module.exports = { searchFlights, confirmFlightPrice };
