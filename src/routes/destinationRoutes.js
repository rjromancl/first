const router = require('express').Router();
const { list, getOne, offers } = require('../controllers/destinationController');

// GET /api/destinations?category=city&popular=true
router.get('/', list);

// GET /api/destinations/:code
router.get('/:code', getOne);

module.exports = router;
