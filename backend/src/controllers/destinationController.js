const { getDestinations, getDestinationByCode, getOffers } = require('../services/destinationService');
const { success, error } = require('../utils/responseHelper');

// GET /api/destinations?category=city&popular=true
function list(req, res) {
  const { category, popular } = req.query;
  return success(res, getDestinations({ category, popular }));
}

// GET /api/destinations/:code
function getOne(req, res) {
  const dest = getDestinationByCode(req.params.code.toUpperCase());
  if (!dest) return error(res, 'Destination not found', 404);
  return success(res, dest);
}

// GET /api/offers?category=sale
function offers(req, res) {
  const { category } = req.query;
  return success(res, getOffers({ category }));
}

module.exports = { list, getOne, offers };
