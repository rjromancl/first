const { checkIn } = require('../services/checkinService');
const { success, error } = require('../utils/responseHelper');

// POST /api/checkin
async function performCheckIn(req, res, next) {
  try {
    const { reference, surname } = req.body;
    if (!reference || !surname) return error(res, 'reference and surname are required', 400);

    const result = await checkIn({ reference, surname });
    return success(res, result);
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    next(err);
  }
}

module.exports = { performCheckIn };
