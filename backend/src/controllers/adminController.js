'use strict';

const User = require('../models/User');
const File = require('../models/File');
const AuditLog = require('../models/AuditLog');

/**
 * GET /api/admin/users
 * List all users (admin only)
 */
const listUsers = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(),
    ]);

    const safeUsers = users.map((u) => ({
      id: u._id,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt,
      loginCount: u.loginCount,
      createdAt: u.createdAt,
    }));

    res.json({
      success: true,
      data: { users: safeUsers, total, page, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/audit
 * Get audit logs with filtering (admin only)
 */
const getAuditLogs = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.userId) filter.userId = req.query.userId;
    if (req.query.action) filter.action = req.query.action;
    if (req.query.fileId) filter.fileId = req.query.fileId;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'email role')
        .populate('fileId', 'originalFilename mimeType')
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: { logs, total, page, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/files
 * List all files across all users (admin only)
 */
const listAllFiles = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [files, total] = await Promise.all([
      File.find({ isDeleted: false })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('ownerId', 'email')
        .lean(),
      File.countDocuments({ isDeleted: false }),
    ]);

    const safeFiles = files.map((f) => ({
      id: f._id,
      originalFilename: f.originalFilename,
      mimeType: f.mimeType,
      size: f.size,
      owner: f.ownerId?.email || 'Unknown',
      createdAt: f.createdAt,
    }));

    res.json({
      success: true,
      data: { files: safeFiles, total, page, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/stats
 * Dashboard stats for admin
 */
const getStats = async (req, res, next) => {
  try {
    const [totalUsers, totalFiles, recentActivity] = await Promise.all([
      User.countDocuments({ isActive: true }),
      File.countDocuments({ isDeleted: false }),
      AuditLog.find()
        .sort({ timestamp: -1 })
        .limit(10)
        .populate('userId', 'email')
        .lean(),
    ]);

    res.json({
      success: true,
      data: { totalUsers, totalFiles, recentActivity },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { listUsers, getAuditLogs, listAllFiles, getStats };
