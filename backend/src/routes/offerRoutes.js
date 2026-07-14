const router = require('express').Router();
const { offers } = require('../controllers/destinationController');

// GET /api/offers?category=sale
router.get('/', offers);

module.exports = router;
