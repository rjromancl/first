const { validationResult } = require('express-validator');
const { error } = require('../utils/responseHelper');

/**
 * Run express-validator checks and return 422 if any fail.
 * Usage: router.post('/path', [...validators], validate, controller)
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return error(res, 'Validation failed', 422, errors.array());
  }
  next();
}

module.exports = { validate };
