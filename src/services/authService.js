const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { UserStore } = require('../models/inMemoryStore');
const logger = require('../config/logger');

const JWT_SECRET  = process.env.JWT_SECRET  || 'change_me_in_production';
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

module.exports = { register, login, verifyToken, getProfile };
