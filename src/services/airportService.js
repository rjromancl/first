/**
 * Airport service — MOCK implementation.
 * No Amadeus calls. Filters the AIRPORTS list from mockData.js.
 */

const cache  = require('../config/cache');
const logger = require('../config/logger');
const { AIRPORTS } = require('../mocks/mockData');

/**
 * Search airports by keyword — matches code, name, city or country.
 */
async function searchAirports(keyword, subType = 'AIRPORT,CITY') {
  if (!keyword || keyword.length < 2) return [];

  const cacheKey = `airports:${keyword.toLowerCase()}`;
  const cached   = cache.get(cacheKey);
  if (cached) return cached;

  logger.debug('[MOCK] Airport search', { keyword });

  const q = keyword.toLowerCase();
  const results = AIRPORTS
    .filter(a =>
      a.iataCode.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q)     ||
      a.cityName.toLowerCase().includes(q) ||
      a.countryName.toLowerCase().includes(q)
    )
    .slice(0, 8)
    .map(a => ({
      code:        a.iataCode,
      iataCode:    a.iataCode,
      name:        a.name,
      city:        a.cityName,
      cityName:    a.cityName,
      country:     a.countryName,
      countryName: a.countryName,
      countryCode: a.countryCode,
      type:        a.subType,
    }));

  cache.set(cacheKey, results, 3600);
  return results;
}

/**
 * Get a single airport by exact IATA code.
 */
async function getAirportByCode(iataCode) {
  const a = AIRPORTS.find(
    ap => ap.iataCode.toUpperCase() === iataCode.toUpperCase()
  );
  if (!a) return null;
  return {
    code:        a.iataCode,
    iataCode:    a.iataCode,
    name:        a.name,
    city:        a.cityName,
    cityName:    a.cityName,
    country:     a.countryName,
    countryCode: a.countryCode,
    type:        a.subType,
  };
}

/**
 * Return the full airport list (used by /airports/all endpoint).
 */
function getAllAirports() {
  return AIRPORTS.map(a => ({
    code:        a.iataCode,
    iataCode:    a.iataCode,
    name:        a.name,
    city:        a.cityName,
    country:     a.countryName,
    countryCode: a.countryCode,
  }));
}

// Keep LOCAL_AIRPORTS export so any file that imports it doesn't break
const LOCAL_AIRPORTS = AIRPORTS;

module.exports = { searchAirports, getAirportByCode, getAllAirports, LOCAL_AIRPORTS };
