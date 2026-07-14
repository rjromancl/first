const Amadeus = require('amadeus');

/**
 * Amadeus SDK client — singleton with auto-configured hostname.
 * The SDK handles OAuth2 token refresh internally.
 */
const amadeus = new Amadeus({
  clientId: process.env.AMADEUS_CLIENT_ID,
  clientSecret: process.env.AMADEUS_CLIENT_SECRET,
  hostname: process.env.AMADEUS_HOSTNAME || 'test', // 'test' | 'production'
  logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'silent',
});

module.exports = amadeus;
