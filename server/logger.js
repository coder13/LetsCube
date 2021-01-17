const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'prod' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.splat(),
    winston.format.simple(),
  ),
  transports: [
    new winston.transports.Console({
      stderrLevels: ['error'],
    }),
  ],
});

logger.error = (err) => {
  if (err instanceof Error) {
    logger.log({ level: 'error', message: `${err.stack || err}` });
  } else {
    logger.log({ level: 'error', message: err });
  }
};

module.exports = logger;
