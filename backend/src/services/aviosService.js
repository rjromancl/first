/**
 * Avios service — MOCK implementation.
 * Distance lookup uses the ROUTE_DISTANCES table; no Amadeus calls.
 */

const cache  = require('../config/cache');
const logger = require('../config/logger');
const { UserStore } = require('../models/inMemoryStore');
const { calculateAvios } = require('../utils/amadeusHelpers');
const { ROUTE_DISTANCES } = require('../mocks/mockData');

/**
 * Calculate Avios for a flight route + cabin.
 * Falls back to 2 000 km for any unknown route.
 */
async function calculateFlightAvios({ origin, destination, cabin = 'economy' }) {
  const routeKey = `${origin.toUpperCase()}-${destination.toUpperCase()}`;
  const cacheKey = `avios:${routeKey}:${cabin}`;

  const cached = cache.get(cacheKey);
  if (cached) return cached;

  logger.info('[MOCK] Avios calculation', { routeKey, cabin });

  const distanceKm = ROUTE_DISTANCES[routeKey] || 2000;
  const avios      = calculateAvios(distanceKm, cabin);

  const result = { origin, destination, cabin, distanceKm, avios };
  cache.set(cacheKey, result, 3600);
  return result;
}

/**
 * Get Avios balance and tier info for an authenticated user.
 */
function getUserAvios(userId) {
  const user = UserStore.findById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  const tierBenefits = {
    Blue:   { earnMultiplier: 1.0,  loungeAccess: false, priorityBoarding: false, freeSeatSelection: false },
    Bronze: { earnMultiplier: 1.25, loungeAccess: false, priorityBoarding: true,  freeSeatSelection: false },
    Silver: { earnMultiplier: 1.5,  loungeAccess: true,  priorityBoarding: true,  freeSeatSelection: true  },
    Gold:   { earnMultiplier: 2.0,  loungeAccess: true,  priorityBoarding: true,  freeSeatSelection: true  },
  };

  const nextTierThresholds = { Blue: 300, Bronze: 600, Silver: 1500, Gold: null };
  const tierPoints         = { Blue: 0,   Bronze: 320, Silver: 650,  Gold: 1800 };

  return {
    avios:            user.avios,
    tier:             user.tier,
    execNumber:       user.execNumber,
    tierPoints:       tierPoints[user.tier] || 0,
    pointsToNextTier: nextTierThresholds[user.tier],
    benefits:         tierBenefits[user.tier] || tierBenefits.Blue,
  };
}

module.exports = { calculateFlightAvios, getUserAvios };
