const router = require('express').Router();
const { query, body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { search, confirmPrice } = require('../controllers/flightController');
const { status } = require('../controllers/flightStatusController');

// ─ GET /api/flights/search ─────────────────────────────────────────
router.get(
  '/search',
  [
    query('from').isString().isLength({ min: 3, max: 3 }).withMessage('from must be a 3-letter IATA code').toUpperCase(),
    query('to').isString().isLength({ min: 3, max: 3 }).withMessage('to must be a 3-letter IATA code').toUpperCase(),
    query('departureDate').isISO8601().withMessage('departureDate must be YYYY-MM-DD'),
    query('adults').optional().isInt({ min: 1, max: 9 }).withMessage('adults must be 1–9'),
    query('cabin').optional().isIn(['ECONOMY','PREMIUM_ECONOMY','BUSINESS','FIRST']).withMessage('invalid cabin class'),
  ],
  validate,
  search
);

// ─ GET /api/flights/status ─────────────────────────────────────────
router.get('/status', status);

// ─ POST /api/flights/confirm-price ────────────────────────────────
router.post(
  '/confirm-price',
  [body('flightOffer').notEmpty().withMessage('flightOffer is required')],
  validate,
  confirmPrice
);

module.exports = router;
