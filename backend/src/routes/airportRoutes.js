const router = require('express').Router();
const { query } = require('express-validator');
const { validate } = require('../middleware/validate');
const { search, all } = require('../controllers/airportController');

// GET /api/airports?q=london
router.get('/', [query('q').optional().isString()], validate, search);

// GET /api/airports/all
router.get('/all', all);

module.exports = router;
