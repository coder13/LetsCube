const createCorsOptions = (origins) => {
  const allowedOrigins = new Set(origins);

  return {
    credentials: true,
    origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
  };
};

module.exports = { createCorsOptions };
