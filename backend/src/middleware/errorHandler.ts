import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

/**
 * Global Error Handler Middleware
 * Captures all unhandled exceptions and returns a consistent JSON response.
 */
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Log the full error for internal tracking
  logger.error(`${req.method} ${req.path} failed: ${message}`, {
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    query: req.query,
    body: req.method !== 'GET' ? req.body : undefined,
    ip: req.ip
  });

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
      ...(err.details && { details: err.details })
    }
  });
};

/**
 * Custom Error Class for API-specific errors
 */
export class APIError extends Error {
  statusCode: number;
  details?: any;

  constructor(message: string, statusCode: number = 500, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, APIError.prototype);
  }
}
