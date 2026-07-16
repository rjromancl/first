/**
 * Vercel Serverless Function — wraps the entire Express backend.
 * Vercel routes all /api/* requests here automatically.
 *
 * This means NO separate backend hosting is needed — the frontend
 * and backend both live on the same Vercel deployment.
 */

// Load env vars (Vercel injects them automatically in production)
const path = require('path');

// Point dotenv at the backend .env (only needed locally)
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

// ── Override PORT — Vercel serverless doesn't use a port ──────────
// Express listen() is never called in serverless mode; Vercel
// calls the exported handler directly.
process.env.PORT = process.env.PORT || '3000';

const express               = require('express');
const cors                  = require('cors');
const helmet                = require('helmet');
const compression           = require('compression');
const rateLimit             = require('express-rate-limit');
const logger                = require('../backend/src/config/logger');
const { errorHandler, notFound } = require('../backend/src/middleware/errorHandler');

const authRoutes        = require('../backend/src/routes/authRoutes');
const flightRoutes      = require('../backend/src/routes/flightRoutes');
const bookingRoutes     = require('../backend/src/routes/bookingRoutes');
const checkinRoutes     = require('../backend/src/routes/checkinRoutes');
const airportRoutes     = require('../backend/src/routes/airportRoutes');
const destinationRoutes = require('../backend/src/routes/destinationRoutes');
const offerRoutes       = require('../backend/src/routes/offerRoutes');
const aviosRoutes       = require('../backend/src/routes/aviosRoutes');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({ windowMs: 900000, max: 200 });
app.use(limiter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'ba-backend', env: process.env.NODE_ENV || 'production', timestamp: new Date().toISOString() });
});

// Routes — all prefixed /api
app.use('/api/auth',         authRoutes);
app.use('/api/flights',      flightRoutes);
app.use('/api/airports',     airportRoutes);
app.use('/api/bookings',     bookingRoutes);
app.use('/api/checkin',      checkinRoutes);
app.use('/api/destinations', destinationRoutes);
app.use('/api/offers',       offerRoutes);
app.use('/api/avios',        aviosRoutes);

app.use(notFound);
app.use(errorHandler);

// Export for Vercel serverless
module.exports = app;
