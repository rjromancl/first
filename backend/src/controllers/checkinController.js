const { checkIn } = require('../services/checkinService');
const { success, error } = require('../utils/responseHelper');

// POST /api/checkin
async function performCheckIn(req, res, next) {
  try {
    const { reference } = req.body;
    if (!reference) return error(res, 'reference is required', 400);

    const result = await checkIn({ reference });
    return success(res, result);
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    next(err);
  }
}

module.exports = { performCheckIn };
