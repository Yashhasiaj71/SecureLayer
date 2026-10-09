'use strict';

const mongoose = require('mongoose');

/**
 * Immutable audit log.
 * SECURITY NOTES:
 * - Never log: passwords, OTP values, encryption keys, file contents
 * - Log: who, what, when, where (IP), success/failure
 * - This collection should be append-only in production
 */
const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        'LOGIN',
        'LOGIN_FAILED',
        'LOGOUT',
        'OTP_REQUESTED',
        'OTP_VERIFIED',
        'OTP_FAILED',
        'OTP_EXPIRED',
        'TOKEN_REFRESHED',
        'FILE_UPLOADED',
        'FILE_VIEWED',
        'FILE_DOWNLOAD_ATTEMPTED',
        'FILE_DELETED',
        'UNAUTHORIZED_FILE_ACCESS_ATTEMPT',
        'PERMISSION_DENIED',
        'RATE_LIMIT_HIT',
        'USER_CREATED',
      ],
      index: true,
    },
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'File',
      default: null,
      index: true,
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    success: {
      type: Boolean,
      required: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      // Additional context — ensure nothing sensitive is stored here
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    // Disable updates on audit logs — append-only
    timestamps: false,
  }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
