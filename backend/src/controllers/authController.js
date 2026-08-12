const { register, login, getProfile, updateProfile, changePassword } = require('../services/authService');
const { success, error } = require('../utils/responseHelper');

// POST /api/auth/register
async function registerUser(req, res, next) {
  try {
    const { email, password, firstName, lastName } = req.body;
    const result = await register({ email, password, firstName, lastName });
    return success(res, result, 201);
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    next(err);
  }
}

// POST /api/auth/login
async function loginUser(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await login({ email, password });
    return success(res, result);
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    next(err);
  }
}

// GET /api/auth/me
function getMe(req, res, next) {
  try {
    const profile = getProfile(req.user.id);
    return success(res, profile);
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    next(err);
  }
}

// PATCH /api/auth/profile
async function updateMyProfile(req, res, next) {
  try {
    const updated = updateProfile(req.user.id, req.body);
    return success(res, updated);
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    next(err);
  }
}

// PATCH /api/auth/password
async function changeMyPassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return error(res, 'currentPassword and newPassword are required', 400);
    if (newPassword.length < 8)
      return error(res, 'New password must be at least 8 characters', 400);
    const result = await changePassword(req.user.id, { currentPassword, newPassword });
    return success(res, result);
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    next(err);
  }
}

module.exports = { registerUser, loginUser, getMe, updateMyProfile, changeMyPassword };
