const { searchFlights, confirmFlightPrice } = require('../services/flightService');
const { success, error } = require('../utils/responseHelper');
const logger = require('../config/logger');

// GET /api/flights/search
async function search(req, res, next) {
  try {
    const {
      from, to, departureDate, returnDate,
      adults = 1, cabin = 'ECONOMY', nonStop = 'false', max = '20',
    } = req.query;

    const result = await searchFlights({
      originLocationCode: from.toUpperCase(),
      destinationLocationCode: to.toUpperCase(),
      departureDate,
      returnDate: returnDate || undefined,
      adults: parseInt(adults),
      travelClass: cabin.toUpperCase(),
      nonStop: nonStop === 'true',
      currencyCode: 'GBP',
      max: Math.min(parseInt(max), 50),
    });

    return success(res, result, 200, {
      count: result.flights.length,
      from, to, departureDate,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/flights/confirm-price
async function confirmPrice(req, res, next) {
  try {
    const { flightOffer } = req.body;
    if (!flightOffer) return error(res, 'flightOffer is required', 400);

    const confirmed = await confirmFlightPrice(flightOffer);
    return success(res, confirmed);
  } catch (err) {
    next(err);
  }
}

module.exports = { search, confirmPrice };
