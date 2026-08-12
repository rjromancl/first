const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { UserStore } = require('../models/inMemoryStore');
const logger = require('../config/logger');

// BUG-SEC-004: Never fall back to a hardcoded secret. If JWT_SECRET is not
// set the server must refuse to start rather than silently use a guessable key.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    'FATAL: JWT_SECRET environment variable is not set. ' +
    'Set a strong random value (e.g. openssl rand -hex 64) before starting the server.'
  );
}
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '7d';

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, tier: user.tier },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

async function register({ email, password, firstName, lastName }) {
  logger.info('Registering user', { email });

  if (UserStore.findByEmail(email)) {
    throw Object.assign(new Error('Email already registered'), { statusCode: 409 });
  }

  const user = await UserStore.create({ email, password, firstName, lastName });
  const token = generateToken(user);

  return { user: UserStore.safeUser(user), token };
}

async function login({ email, password }) {
  logger.info('Login attempt', { email });

  const user = UserStore.findByEmail(email);
  if (!user) {
    throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 });
  }

  const token = generateToken(user);
  return { user: UserStore.safeUser(user), token };
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function getProfile(userId) {
  const user = UserStore.findById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  return UserStore.safeUser(user);
}

function updateProfile(userId, fields) {
  const user = UserStore.findById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  const updated = UserStore.updateProfile(user.email, fields);
  return UserStore.safeUser(updated);
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const user = UserStore.findById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw Object.assign(new Error('Current password is incorrect'), { statusCode: 401 });
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  return { changed: true };
}

module.exports = { register, login, verifyToken, getProfile, updateProfile, changePassword };
