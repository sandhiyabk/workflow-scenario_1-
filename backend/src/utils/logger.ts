import winston from 'winston';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const consoleFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack, ...meta }) => {
    let output = `[${timestamp}] ${level}: ${message}`;
    if (Object.keys(meta).length > 0) {
      output += ` \n${JSON.stringify(meta, null, 2)}`;
    }
    if (stack) {
      output += `\n${stack}`;
    }
    return output;
  })
);

// Create a structured Winston logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp(),
    errors({ stack: true }),
    json() // Default to JSON for structural logging
  ),
  defaultMeta: { service: 'workflow-engine' },
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' ? json() : consoleFormat,
    })
  ],
});
