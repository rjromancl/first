const router = require('express').Router();
const { body, param, query } = require('express-validator');
const { validate } = require('../middleware/validate');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const ctrl = require('../controllers/bookingController');

// ─ POST /api/bookings — create (auth optional so guests can book) ──
router.post(
  '/',
  optionalAuth,
  [
    body('travelers').isArray({ min: 1 }).withMessage('At least one traveler required'),
    body('travelers.*.firstName').notEmpty().withMessage('Traveler firstName required'),
    body('travelers.*.lastName').notEmpty().withMessage('Traveler lastName required'),
  ],
  validate,
  ctrl.create
);

// ─ GET /api/bookings/mine — authenticated user's bookings ──────────
router.get('/mine', requireAuth, ctrl.listMine);

// ─ GET /api/bookings/:reference?surname=Wilson ────────────────────
router.get(
  '/:reference',
  [
    param('reference').isLength({ min: 6, max: 6 }).withMessage('Reference must be 6 characters'),
    query('surname').notEmpty().withMessage('surname is required'),
  ],
  validate,
  ctrl.retrieve
);

// ─ PATCH /api/bookings/:reference — update booking details ────────
router.patch('/:reference', optionalAuth, ctrl.update);

// ─ PATCH /api/bookings/:reference/seat — seat selection ──────────
router.patch(
  '/:reference/seat',
  [body('seat').notEmpty().withMessage('seat is required')],
  validate,
  ctrl.selectSeat
);

// ─ PATCH /api/bookings/:reference/bags — add baggage ─────────────
router.patch(
  '/:reference/bags',
  [
    body('checked').isInt({ min: 0, max: 10 }).withMessage('checked bags must be 0–10'),
    body('cabin').isInt({ min: 1, max: 2 }).withMessage('cabin bags must be 1–2'),
  ],
  validate,
  ctrl.updateBags
);

// ─ DELETE /api/bookings/:reference — cancel booking ──────────────
router.delete('/:reference', requireAuth, ctrl.cancel);

module.exports = router;
