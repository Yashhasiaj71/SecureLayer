'use strict';

const tokenService = require('../services/tokenService');
const User = require('../models/User');

/**
 * Authentication middleware.
 * Verifies the JWT access token from the Authorization header.
 * Fetches fresh user data from DB to catch revoked/deactivated users.
 */
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const token = authHeader.slice(7); // Remove "Bearer "
    const payload = tokenService.verifyAccessToken(token);

    if (!payload) {
      return res.status(401).json({
        success: false,
        error: { code: 'TOKEN_INVALID', message: 'Invalid or expired token' },
      });
    }

    // Fetch fresh user from DB — catches deactivated accounts mid-session
    const user = await User.findById(payload.sub).lean();

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: { code: 'ACCOUNT_INACTIVE', message: 'Account not found or inactive' },
      });
    }

    // Attach user to request context
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { requireAuth };
