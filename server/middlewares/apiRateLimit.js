const API_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const API_RATE_LIMIT_MAX = 300;

const apiRateLimitOptions = (options = {}) => ({
  legacyHeaders: false,
  limit: API_RATE_LIMIT_MAX,
  message: {
    code: 'rate_limited',
    message: 'Too many requests. Please try again later.',
  },
  standardHeaders: 'draft-8',
  windowMs: API_RATE_LIMIT_WINDOW_MS,
  ...options,
});

module.exports = {
  API_RATE_LIMIT_MAX,
  API_RATE_LIMIT_WINDOW_MS,
  apiRateLimitOptions,
};
