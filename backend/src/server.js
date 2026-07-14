require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const logger = require('./config/logger');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// ─── Routes ───────────────────────────────────────────────────────
const authRoutes        = require('./routes/authRoutes');
const flightRoutes      = require('./routes/flightRoutes');
const bookingRoutes     = require('./routes/bookingRoutes');
const checkinRoutes     = require('./routes/checkinRoutes');
const airportRoutes     = require('./routes/airportRoutes');
const destinationRoutes = require('./routes/destinationRoutes');
const offerRoutes       = require('./routes/offerRoutes');
const aviosRoutes       = require('./routes/aviosRoutes');

const app = express();

// ─── Security / compression ───────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());

// ─── CORS ─────────────────────────────────────────────────────────
// In production (Railway) we accept any HTTPS origin so the Vercel
// frontend can reach the API regardless of its preview/prod URL.
// In development we restrict to the explicit allowlist.
const isProduction = process.env.NODE_ENV === 'production';

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, cb) => {
      // Always allow requests with no origin (curl, Postman, mobile apps)
      if (!origin) return cb(null, true);
      // In production: allow any HTTPS origin (Vercel, custom domains, etc.)
      if (isProduction && origin.startsWith('https://')) return cb(null, true);
      // In development: restrict to allowlist
      if (allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Body parsing ─────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── HTTP request logging ─────────────────────────────────────────
app.use(
  morgan('combined', {
    stream: { write: (msg) => logger.http(msg.trim()) },
    skip: (req) => req.path === '/health',
  })
);

// ─── Rate limiting ────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many requests, please try again later.', statusCode: 429 } },
});

// Stricter limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: { message: 'Too many auth attempts.', statusCode: 429 } },
});

// Tighter limiter for Amadeus-backed endpoints to protect API quota
const amadeusLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 30,
  message: { success: false, error: { message: 'Search rate limit reached. Please wait a moment.', statusCode: 429 } },
});

app.use(globalLimiter);

// ─── Health check ─────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ba-backend',
    version: require('../package.json').version,
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
  });
});

// ─── API Routes ───────────────────────────────────────────────────
app.use('/api/auth',         authLimiter,    authRoutes);
app.use('/api/flights',      amadeusLimiter, flightRoutes);
app.use('/api/airports',     amadeusLimiter, airportRoutes);
app.use('/api/bookings',                     bookingRoutes);
app.use('/api/checkin',                      checkinRoutes);
app.use('/api/destinations',                 destinationRoutes);
app.use('/api/offers',                       offerRoutes);
app.use('/api/avios',        amadeusLimiter, aviosRoutes);

// ─── 404 + Error Handling ─────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '4000');
app.listen(PORT, () => {
  logger.info(`BA Backend running on port ${PORT}`, {
    env: process.env.NODE_ENV || 'development',
    amadeusHostname: process.env.AMADEUS_HOSTNAME || 'test',
  });
});

module.exports = app; // exported for tests
