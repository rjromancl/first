const { searchAirports, getAllAirports } = require('../services/airportService');
const { success, error } = require('../utils/responseHelper');

// GET /api/airports?q=londo&type=AIRPORT
async function search(req, res, next) {
  try {
    const { q, type } = req.query;
    if (!q || q.length < 2) return error(res, 'Query must be at least 2 characters', 400);

    const results = await searchAirports(q, type || 'AIRPORT,CITY');
    return success(res, results);
  } catch (err) {
    next(err);
  }
}

// GET /api/airports/all  — return full list
function all(req, res) {
  return success(res, getAllAirports());
}

module.exports = { search, all };
