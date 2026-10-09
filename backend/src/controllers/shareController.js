'use strict';

const File = require('../models/File');
const User = require('../models/User');
const FileAccessRequest = require('../models/FileAccessRequest');
const emailProvider = require('../services/emailProvider');
const auditService = require('../services/auditService');

/**
 * GET /api/files/global
 * List all files in the system, excluding user's own files.
 */
const getGlobalFiles = async (req, res, next) => {
  try {
    const files = await File.find({
      ownerId: { $ne: req.user._id },
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .lean();

    // Populate owner emails and check if current user has a pending/approved request
    const safeFiles = await Promise.all(
      files.map(async (f) => {
        const owner = await User.findById(f.ownerId).select('email').lean();
        const request = await FileAccessRequest.findOne({
          fileId: f._id,
          requesterId: req.user._id,
        }).lean();

        return {
          id: f._id,
          originalFilename: f.originalFilename,
          mimeType: f.mimeType,
          size: f.size,
          createdAt: f.createdAt,
          ownerEmail: owner?.email || 'Unknown',
          accessStatus: request ? request.status : null, // PENDING, APPROVED, DENIED, or null
        };
      })
    );

    res.json({ success: true, data: { files: safeFiles } });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/share/request/:fileId
 * Request access to a file.
 */
const requestAccess = async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const { ipAddress, userAgent } = auditService.extractRequestContext(req);

    const file = await File.findById(fileId);
    if (!file || file.isDeleted) {
      return res.status(404).json({ success: false, error: { message: 'File not found' } });
    }

    if (file.ownerId.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, error: { message: 'You already own this file' } });
    }

    // Check if request already exists
    let accessRequest;
    const existingReq = await FileAccessRequest.findOne({ fileId, requesterId: req.user._id });
    
    if (existingReq) {
      if (existingReq.status === 'PENDING' || existingReq.status === 'APPROVED') {
        return res.status(400).json({ success: false, error: { message: `Request already ${existingReq.status}` } });
      }
      // Re-demand access
      existingReq.status = 'PENDING';
      await existingReq.save();
      accessRequest = existingReq;
    } else {
      accessRequest = await FileAccessRequest.create({
        fileId,
        requesterId: req.user._id,
        ownerId: file.ownerId,
        status: 'PENDING',
      });
    }

    const owner = await User.findById(file.ownerId);
    const requester = await User.findById(req.user._id);

    // Send email to owner if preferences allow
    if (owner.preferences?.emailNotifications !== false) {
      await emailProvider.sendAccessRequestEmail(owner.email, requester.email, file.originalFilename);
    }

    await auditService.log({
      userId: req.user._id,
      action: 'FILE_ACCESS_REQUESTED',
      fileId,
      ipAddress,
      userAgent,
      success: true,
    });

    res.json({ success: true, data: { request: accessRequest } });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/share/requests/incoming
 * List requests made TO the current user for their files.
 */
const getIncomingRequests = async (req, res, next) => {
  try {
    const requests = await FileAccessRequest.find({ ownerId: req.user._id })
      .populate('requesterId', 'email')
      .populate('fileId', 'originalFilename')
      .sort({ createdAt: -1 })
      .lean();

    const formatted = requests.map(r => ({
      id: r._id,
      requesterEmail: r.requesterId?.email,
      filename: r.fileId?.originalFilename,
      status: r.status,
      createdAt: r.createdAt,
    }));

    res.json({ success: true, data: { requests: formatted } });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/share/requests/:requestId/approve
 */
const approveRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    
    const request = await FileAccessRequest.findOne({ _id: requestId, ownerId: req.user._id }).populate('fileId').populate('requesterId');
    if (!request) {
      return res.status(404).json({ success: false, error: { message: 'Request not found' } });
    }

    request.status = 'APPROVED';
    await request.save();

    if (request.requesterId.preferences?.emailNotifications !== false) {
      await emailProvider.sendAccessGrantedEmail(request.requesterId.email, req.user.email, request.fileId.originalFilename);
    }

    res.json({ success: true, message: 'Request approved' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/share/requests/:requestId/deny
 */
const denyRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    
    const request = await FileAccessRequest.findOne({ _id: requestId, ownerId: req.user._id });
    if (!request) {
      return res.status(404).json({ success: false, error: { message: 'Request not found' } });
    }

    request.status = 'DENIED';
    await request.save();

    res.json({ success: true, message: 'Request denied' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getGlobalFiles,
  requestAccess,
  getIncomingRequests,
  approveRequest,
  denyRequest
};
