const NodeCache = require('node-cache');

/**
 * In-memory cache with configurable TTL.
 * Used to cache Amadeus responses to avoid rate-limit exhaustion
 * during development / repeated identical searches.
 */
const cache = new NodeCache({
  stdTTL: 300,        // 5 minutes default
  checkperiod: 60,    // cleanup every 60s
  useClones: false,
});

module.exports = cache;
