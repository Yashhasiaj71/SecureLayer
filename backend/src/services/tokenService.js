'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const RefreshToken = require('../models/RefreshToken');
const config = require('../config/environment');

/**
 * Token Service — manages JWT access tokens and refresh token lifecycle.
 *
 * Architecture:
 * - Access token: Short-lived JWT (15 min), delivered in response body
 *   → Stored in memory by Flutter client (NOT localStorage)
 * - Refresh token: Long-lived opaque token (7 days), in HttpOnly cookie
 *   → Stored as SHA-256 hash in DB for revocation support
 *
 * SECURITY: Refresh token rotation — issue a new refresh token on each use.
 * If a stolen token is used, the legitimate user's next refresh will fail.
 */

/**
 * Hash a raw token for storage (SHA-256, not bcrypt — faster for lookup).
 * @param {string} token
 * @returns {string} hex hash
 */
const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

const tokenService = {
  /**
   * Generate a signed JWT access token.
   * @param {Object} user - User document
   * @returns {string} JWT
   */
  generateAccessToken(user) {
    return jwt.sign(
      {
        sub: user._id.toString(),
        email: user.email,
        role: user.role,
        // SECURITY: Role is in token for middleware efficiency,
        // but ALL permission checks are backed by DB or RBAC map — not just token role
      },
      config.jwt.secret,
      {
        expiresIn: config.jwt.accessExpiresIn,
        algorithm: 'HS256',
      }
    );
  },

  /**
   * Generate an opaque refresh token and store its hash in DB.
   * @param {string} userId
   * @param {Object} context - { ipAddress, userAgent }
   * @returns {Promise<string>} raw refresh token (to set in cookie)
   */
  async generateRefreshToken(userId, { ipAddress, userAgent } = {}) {
    // Generate 64 cryptographically random bytes
    const rawToken = crypto.randomBytes(64).toString('hex');
    const tokenHash = hashToken(rawToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await RefreshToken.create({
      userId,
      tokenHash,
      expiresAt,
      isRevoked: false,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    });

    return rawToken;
  },

  /**
   * Verify a raw refresh token and return the associated userId.
   * Performs token rotation — old token revoked, new token issued.
   * @param {string} rawToken
   * @param {Object} context - { ipAddress, userAgent }
   * @returns {Promise<{ userId: string, newRawToken: string } | null>}
   */
  async rotateRefreshToken(rawToken, context = {}) {
    if (!rawToken) return null;

    const tokenHash = hashToken(rawToken);
    const record = await RefreshToken.findOne({ tokenHash, isRevoked: false });

    if (!record) return null;
    if (new Date() > record.expiresAt) {
      await RefreshToken.deleteOne({ _id: record._id });
      return null;
    }

    // Revoke the used token (rotation)
    await RefreshToken.updateOne({ _id: record._id }, { isRevoked: true });

    // Issue new refresh token
    const newRawToken = await tokenService.generateRefreshToken(
      record.userId,
      context
    );

    return { userId: record.userId.toString(), newRawToken };
  },

  /**
   * Revoke all refresh tokens for a user (logout all sessions).
   * @param {string} userId
   */
  async revokeAllUserTokens(userId) {
    await RefreshToken.updateMany(
      { userId, isRevoked: false },
      { isRevoked: true }
    );
  },

  /**
   * Revoke a specific refresh token (single device logout).
   * @param {string} rawToken
   */
  async revokeToken(rawToken) {
    const tokenHash = hashToken(rawToken);
    await RefreshToken.updateOne({ tokenHash }, { isRevoked: true });
  },

  /**
   * Verify a JWT access token.
   * @param {string} token
   * @returns {{ sub, email, role } | null}
   */
  verifyAccessToken(token) {
    try {
      return jwt.verify(token, config.jwt.secret);
    } catch {
      return null;
    }
  },

  /**
   * Refresh token cookie options.
   * SECURITY: HttpOnly + Secure + SameSite=Strict
   */
  getRefreshCookieOptions() {
    return {
      httpOnly: true,         // JS cannot read this cookie
      secure: config.isProduction, // HTTPS only in production
      sameSite: 'strict',     // CSRF protection
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
      path: '/api/auth',      // Limit cookie scope to auth endpoints only
    };
  },
};

module.exports = tokenService;
