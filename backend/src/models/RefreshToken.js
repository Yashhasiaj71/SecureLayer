'use strict';

const mongoose = require('mongoose');

/**
 * Refresh token storage for token rotation and revocation.
 * Stores hashed token value — raw token is only ever in the HttpOnly cookie.
 */
const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      // SECURITY: SHA-256 hash of the raw token, not plaintext
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL auto-cleanup
    },
    isRevoked: {
      type: Boolean,
      default: false,
    },
    userAgent: {
      type: String,
      default: null,
    },
    ipAddress: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient lookup during refresh
refreshTokenSchema.index({ tokenHash: 1, isRevoked: 1 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
