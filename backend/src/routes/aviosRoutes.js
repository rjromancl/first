const router = require('express').Router();
const { query } = require('express-validator');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { calculate, balance } = require('../controllers/aviosController');

// GET /api/avios/calculate?from=LHR&to=JFK&cabin=economy
router.get(
  '/calculate',
  [
    query('from').isLength({ min: 3, max: 3 }).withMessage('from must be a 3-letter IATA code'),
    query('to').isLength({ min: 3, max: 3 }).withMessage('to must be a 3-letter IATA code'),
    query('cabin').optional().isIn(['economy','premium_economy','business','first']),
  ],
  validate,
  calculate
);

// GET /api/avios/balance  — requires authentication
router.get('/balance', requireAuth, balance);

module.exports = router;
