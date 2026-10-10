'use strict';

const File = require('../models/File');
const FileAccessRequest = require('../models/FileAccessRequest');
const auditService = require('../services/auditService');

/**
 * Valid CamDetection event types the frontend may report.
 * Server validates these — client cannot inject arbitrary action types.
 */
const VALID_CAM_EVENTS = [
  'CAMDETECTION_SESSION_STARTED',
  'CAMDETECTION_SESSION_ENDED',
  'CAMDETECTION_PERMISSION_DENIED',
  'CAMDETECTION_INIT_FAILED',
  'CAMDETECTION_ELEVATED_RISK',
  'CAMDETECTION_HIGH_RISK',
  'CAMDETECTION_RESUMED',
];

/**
 * POST /api/cam/audit
 * Record a CamDetection session event.
 *
 * SECURITY:
 * - We verify the user has legitimate access to the file before logging.
 * - Client-supplied riskScore is stored as metadata ONLY — it is never used
 *   for access control decisions. The server still enforces authorization.
 * - Raw frames, biometrics, and video data must NEVER be sent here.
 */
const logCamEvent = async (req, res, next) => {
  try {
    const { fileId, eventType, riskLevel, reasonCodes } = req.body;
    const { ipAddress, userAgent } = auditService.extractRequestContext(req);

    // Validate event type — never accept arbitrary strings
    if (!VALID_CAM_EVENTS.includes(eventType)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_EVENT', message: 'Unknown CamDetection event type' },
      });
    }

    // Validate fileId format
    if (fileId && !/^[0-9a-fA-F]{24}$/.test(fileId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_FILE_ID', message: 'Invalid file ID format' },
      });
    }

    // If fileId provided, verify the user actually has access (owner, admin, or approved requester)
    if (fileId) {
      const fileDoc = await File.findOne({ _id: fileId, isDeleted: false }).lean();
      if (!fileDoc) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'File not found' },
        });
      }

      const isOwner = fileDoc.ownerId.toString() === req.user._id.toString();
      const isAdmin = req.user.role === 'ADMIN';

      if (!isOwner && !isAdmin) {
        // Check for approved shared access
        const approvedRequest = await FileAccessRequest.findOne({
          fileId: fileDoc._id,
          requesterId: req.user._id,
          status: 'APPROVED',
        }).lean();

        if (!approvedRequest) {
          return res.status(403).json({
            success: false,
            error: { code: 'FORBIDDEN', message: 'No authorized access to this file' },
          });
        }
      }
    }

    // Sanitize metadata — only safe fields, no raw frames or biometrics
    const safeMetadata = {
      // riskLevel from client is informational only, not used for authorization
      clientReportedRiskLevel: ['LOW', 'ELEVATED', 'HIGH'].includes(riskLevel) ? riskLevel : 'UNKNOWN',
      reasonCodes: Array.isArray(reasonCodes)
        ? reasonCodes.slice(0, 10).filter((c) => typeof c === 'string' && c.length < 64)
        : [],
    };

    await auditService.log({
      userId: req.user._id,
      action: eventType,
      fileId: fileId || null,
      ipAddress,
      userAgent,
      success: true,
      metadata: safeMetadata,
    });

    res.status(202).json({ success: true });
  } catch (err) {
    next(err);
  }
};

module.exports = { logCamEvent };
