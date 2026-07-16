/**
 * Amadeus SDK client — singleton.
 *
 * In mock mode (no credentials set) we return a dummy object so the
 * server starts cleanly. All actual Amadeus calls are replaced by
 * mock data anyway, so this object is never called in production.
 */
const Amadeus = require('amadeus');

let amadeus;

const clientId     = process.env.AMADEUS_CLIENT_ID;
const clientSecret = process.env.AMADEUS_CLIENT_SECRET;

if (clientId && clientId !== 'YOUR_AMADEUS_CLIENT_ID' && clientSecret && clientSecret !== 'YOUR_AMADEUS_CLIENT_SECRET') {
  amadeus = new Amadeus({
    clientId,
    clientSecret,
    hostname: process.env.AMADEUS_HOSTNAME || 'test',
    logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'silent',
  });
} else {
  // Mock mode — return a safe no-op object
  amadeus = {
    referenceData: { locations: { get: async () => ({ data: [] }) } },
    shopping:      { flightOffersSearch: { get: async () => ({ data: [] }) }, flightOffers: { pricing: { post: async () => ({ data: {} }) } } },
    booking:       { flightOrders: { post: async () => ({ data: {} }) } },
    schedule:      { flights: { get: async () => ({ data: [] }) } },
    _isMock: true,
  };
}

module.exports = amadeus;
