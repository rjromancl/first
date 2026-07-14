const { verifyToken } = require('../services/authService');
const { error } = require('../utils/responseHelper');

/**
 * Protect routes — requires valid JWT in Authorization: Bearer <token>
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return error(res, 'Authentication required', 401);
  }
  try {
    const token = header.split(' ')[1];
    req.user = verifyToken(token);
    next();
  } catch (err) {
    return error(res, 'Invalid or expired token', 401);
  }
}

/**
 * Optional auth — attaches user if token present, does not block.
 */
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      req.user = verifyToken(header.split(' ')[1]);
    } catch (_) {}
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
