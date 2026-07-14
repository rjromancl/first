const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { performCheckIn } = require('../controllers/checkinController');

// POST /api/checkin
router.post(
  '/',
  [
    body('reference').isLength({ min: 6, max: 6 }).withMessage('Reference must be 6 characters'),
    body('surname').notEmpty().trim().withMessage('Surname required'),
  ],
  validate,
  performCheckIn
);

module.exports = router;
