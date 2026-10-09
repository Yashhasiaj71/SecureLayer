'use strict';

/**
 * RBAC (Role-Based Access Control) Definitions
 *
 * Permissions are defined centrally here — never scattered as
 * inline string comparisons throughout the codebase.
 *
 * Migration path: replace this static map with a DB-backed
 * Role/Permission collection for dynamic RBAC.
 */

const ROLES = Object.freeze({
  USER: 'USER',
  ADMIN: 'ADMIN',
});

const PERMISSIONS = Object.freeze({
  [ROLES.USER]: Object.freeze([
    'file.read',
    'file.upload',
    'file.download',
    'file.delete.own', // Can only delete own files
  ]),

  [ROLES.ADMIN]: Object.freeze([
    'file.read',
    'file.upload',
    'file.download',
    'file.delete',
    'file.delete.own',
    'file.share',
    'user.read',
    'user.manage',
    'audit.read',
  ]),
});

/**
 * Check if a role has a specific permission.
 * @param {string} role - User role
 * @param {string} permission - Permission to check
 * @returns {boolean}
 */
const hasPermission = (role, permission) => {
  const rolePermissions = PERMISSIONS[role];
  if (!rolePermissions) return false;
  return rolePermissions.includes(permission);
};

module.exports = { ROLES, PERMISSIONS, hasPermission };
