const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { registerUser, loginUser, getMe } = require('../controllers/authController');

// POST /api/auth/register
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('firstName').notEmpty().trim().withMessage('First name required'),
    body('lastName').notEmpty().trim().withMessage('Last name required'),
  ],
  validate,
  registerUser
);

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
  ],
  validate,
  loginUser
);

// GET /api/auth/me
router.get('/me', requireAuth, getMe);

module.exports = router;
