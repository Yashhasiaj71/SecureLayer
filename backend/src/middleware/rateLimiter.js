'use strict';

const rateLimit = require('express-rate-limit');
const config = require('../config/environment');

/**
 * Standard API rate limiter.
 * Applied globally to prevent abuse.
 */
/* 
  --- RATE LIMITERS PAUSED FOR DEVELOPMENT ---
  To re-enable rate limiting, delete these 3 lines below and uncomment the actual limiters!
*/
const apiLimiter = (req, res, next) => next();
const otpLimiter = (req, res, next) => next();
const authLimiter = (req, res, next) => next();

/* 
// To Re-enable: Uncomment this block
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later' },
  },
  skipSuccessfulRequests: false,
});

const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: config.rateLimit.otpMax,
  keyGenerator: (req) => {
    return `otp:${(req.body?.email || '').toLowerCase().trim()}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'OTP_RATE_LIMIT',
      message: 'Too many OTP requests. Please wait before requesting another.',
    },
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT',
      message: 'Too many authentication attempts. Please try again later.',
    },
  },
});
*/

module.exports = { apiLimiter, otpLimiter, authLimiter };
