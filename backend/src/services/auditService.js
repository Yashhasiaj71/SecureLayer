'use strict';

const AuditLog = require('../models/AuditLog');

/**
 * Audit service — centralized, fire-and-forget logging.
 * Errors in audit logging must NOT disrupt the main request flow.
 *
 * SECURITY: Never log passwords, OTPs, encryption keys, file contents.
 */
const auditService = {
  /**
   * Log an audit event.
   * @param {Object} params
   * @param {string|null} params.userId
   * @param {string} params.action - Must match AuditLog enum
   * @param {string|null} params.fileId
   * @param {string|null} params.ipAddress
   * @param {string|null} params.userAgent
   * @param {boolean} params.success
   * @param {Object} params.metadata - Additional context (no sensitive data)
   */
  async log({
    userId = null,
    action,
    fileId = null,
    ipAddress = null,
    userAgent = null,
    success,
    metadata = {},
  }) {
    try {
      await AuditLog.create({
        userId: userId || null,
        action,
        fileId: fileId || null,
        ipAddress,
        userAgent,
        success,
        metadata,
        timestamp: new Date(),
      });
    } catch (err) {
      // SECURITY: Audit log failure must not halt the request — but do flag it
      console.error('[Audit] Failed to write audit log:', err.message);
    }
  },

  /**
   * Extract request context for audit logging.
   * @param {import('express').Request} req
   * @returns {{ ipAddress: string, userAgent: string }}
   */
  extractRequestContext(req) {
    return {
      ipAddress: req.ip || req.connection?.remoteAddress || null,
      userAgent: req.headers['user-agent'] || null,
    };
  },
};

module.exports = auditService;
