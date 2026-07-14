const logger = require('../config/logger');

/**
 * Global error handler — must be registered LAST in Express middleware chain.
 * Converts any thrown error into a consistent JSON error envelope.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const statusCode = err.statusCode || err.status || 500;

  // Log server errors (5xx) with full stack; client errors (4xx) as warnings
  if (statusCode >= 500) {
    logger.error('Unhandled server error', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  } else {
    logger.warn('Client error', {
      message: err.message,
      statusCode,
      path: req.path,
    });
  }

  // Handle Amadeus API errors
  if (err.response && err.response.statusCode) {
    const amadeusErrors = err.response.result?.errors || [];
    return res.status(err.response.statusCode || 502).json({
      success: false,
      error: {
        message: 'Amadeus API error',
        statusCode: err.response.statusCode,
        details: amadeusErrors,
      },
    });
  }

  return res.status(statusCode).json({
    success: false,
    error: {
      message: statusCode >= 500 ? 'Internal server error' : err.message,
      statusCode,
    },
  });
}

/**
 * 404 catch-all — register BEFORE errorHandler.
 */
function notFound(req, res) {
  res.status(404).json({
    success: false,
    error: { message: `Route ${req.method} ${req.path} not found`, statusCode: 404 },
  });
}

module.exports = { errorHandler, notFound };
