const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { performCheckIn } = require('../controllers/checkinController');

// POST /api/checkin — must be authenticated to prevent brute-force on short refs
router.post(
  '/',
  requireAuth,
  [
    body('reference')
      .isLength({ min: 6, max: 6 })
      .withMessage('Reference must be 6 characters'),
  ],
  validate,
  performCheckIn
);

module.exports = router;
