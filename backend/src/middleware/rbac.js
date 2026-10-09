'use strict';

const { hasPermission } = require('../utils/rbacDefinitions');
const auditService = require('../services/auditService');

/**
 * RBAC middleware factory.
 * Returns a middleware that checks if req.user has the specified permission.
 *
 * SECURITY: Permission checks are enforced server-side.
 * Frontend permission checks are UI-only and NOT a security boundary.
 *
 * @param {string} permission - Required permission string
 * @returns {import('express').RequestHandler}
 */
const requirePermission = (permission) => async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
  }

  const allowed = hasPermission(req.user.role, permission);

  if (!allowed) {
    const { ipAddress, userAgent } = auditService.extractRequestContext(req);
    await auditService.log({
      userId: req.user._id,
      action: 'PERMISSION_DENIED',
      ipAddress,
      userAgent,
      success: false,
      metadata: { requiredPermission: permission, userRole: req.user.role },
    });

    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
    });
  }

  next();
};

/**
 * Admin-only shorthand middleware.
 */
const requireAdmin = requirePermission('user.manage');

module.exports = { requirePermission, requireAdmin };
