'use strict';

const config = require('../config/environment');

/**
 * Global error handler middleware.
 *
 * SECURITY:
 * - Never expose stack traces in production
 * - Never expose internal error messages that could aid attackers
 * - Log full error server-side, return generic message to client
 */
const errorHandler = (err, req, res, next) => {
  // Log full error server-side (never sent to client)
  console.error('[Error]', {
    message: err.message,
    stack: config.isProduction ? '[hidden in production]' : err.stack,
    path: req.path,
    method: req.method,
  });

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input data' },
    });
  }

  // Handle Mongoose duplicate key errors
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      error: { code: 'CONFLICT', message: 'Resource already exists' },
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: { code: 'TOKEN_INVALID', message: 'Invalid or expired token' },
    });
  }

  // Handle Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: { code: 'FILE_TOO_LARGE', message: 'File exceeds maximum allowed size' },
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_FILE', message: 'Unexpected file field' },
    });
  }

  // Default: generic 500
  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      // Generic message in production — never expose internals
      message: config.isProduction ? 'An internal error occurred' : err.message,
    },
  });
};

/**
 * 404 handler — placed after all routes.
 */
const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Endpoint not found' },
  });
};

module.exports = { errorHandler, notFound };
