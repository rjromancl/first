const { getFlightStatus, getFlightsByRoute } = require('../services/flightStatusService');
const { success, error } = require('../utils/responseHelper');

// GET /api/flights/status?flightNumber=BA117&date=2026-08-15
async function status(req, res, next) {
  try {
    const { flightNumber, date, from, to } = req.query;

    if (from && to) {
      const results = await getFlightsByRoute({
        origin: from.toUpperCase(),
        destination: to.toUpperCase(),
        departureDate: date || new Date().toISOString().split('T')[0],
      });
      return success(res, results);
    }

    if (!flightNumber) return error(res, 'flightNumber or from+to is required', 400);

    // Parse "BA117" → carrierCode="BA", flightNumber="117"
    const match = flightNumber.trim().match(/^([A-Z]{2})(\d{1,4})$/i);
    if (!match) return error(res, 'Invalid flight number format. Expected e.g. BA117', 400);

    const [, carrierCode, num] = match;
    const results = await getFlightStatus({
      carrierCode: carrierCode.toUpperCase(),
      flightNumber: num,
      scheduledDepartureDate: date || new Date().toISOString().split('T')[0],
    });

    return success(res, results);
  } catch (err) {
    next(err);
  }
}

module.exports = { status };
