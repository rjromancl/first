const { calculateFlightAvios, getUserAvios } = require('../services/aviosService');
const { success, error } = require('../utils/responseHelper');

// GET /api/avios/calculate?from=LHR&to=JFK&cabin=business
async function calculate(req, res, next) {
  try {
    const { from, to, cabin = 'economy' } = req.query;
    if (!from || !to) return error(res, 'from and to are required', 400);

    const result = await calculateFlightAvios({
      origin: from.toUpperCase(),
      destination: to.toUpperCase(),
      cabin: cabin.toLowerCase(),
    });
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

// GET /api/avios/balance  — authenticated
function balance(req, res, next) {
  try {
    const result = getUserAvios(req.user.id);
    return success(res, result);
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    next(err);
  }
}

module.exports = { calculate, balance };
