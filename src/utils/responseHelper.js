/**
 * Standardised JSON response envelope used by all controllers.
 */

const success = (res, data, statusCode = 200, meta = {}) => {
  const payload = { success: true, data };
  if (Object.keys(meta).length) payload.meta = meta;
  return res.status(statusCode).json(payload);
};

const error = (res, message, statusCode = 500, details = null) => {
  const payload = { success: false, error: { message, statusCode } };
  if (details) payload.error.details = details;
  return res.status(statusCode).json(payload);
};

const paginated = (res, data, page, limit, total) => {
  return res.status(200).json({
    success: true,
    data,
    meta: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  });
};

module.exports = { success, error, paginated };
