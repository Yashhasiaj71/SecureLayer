'use strict';

const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const File = require('../models/File');
const FileAccessRequest = require('../models/FileAccessRequest');
const encryptionService = require('../services/encryptionService');
const storageService = require('../services/storageService');
const auditService = require('../services/auditService');
const config = require('../config/environment');

// ─── Multer Configuration ─────────────────────────────────────────────────────
// Store in memory — we encrypt before writing to disk

/**
 * MIME type validation using both mimetype and extension.
 * Neither alone is sufficient — clients can spoof both,
 * but requiring both match reduces attack surface.
 */
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (
    !config.upload.allowedMimeTypes.includes(file.mimetype) ||
    !config.upload.allowedExtensions.includes(ext)
  ) {
    return cb(
      Object.assign(new Error('File type not allowed'), { status: 400, code: 'INVALID_FILE_TYPE' }),
      false
    );
  }

  cb(null, true);
};

const upload = multer({
  storage: multer.memoryStorage(), // In memory — not written to disk unencrypted
  limits: {
    fileSize: config.upload.maxFileSizeBytes,
    files: 1, // One file per request
  },
  fileFilter,
});

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * POST /api/files/upload
 * Upload, validate, encrypt, and store a file.
 */
const uploadFile = [
  upload.single('file'),
  async (req, res, next) => {
    try {
      const { ipAddress, userAgent } = auditService.extractRequestContext(req);

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: 'No file provided' },
        });
      }

      const { originalname, mimetype, size, buffer } = req.file;

      // Generate UUID-based storage key — NEVER use originalname in filesystem path
      const storageKey = `${crypto.randomUUID()}.enc`;

      // Encrypt the file buffer
      const { encryptedBuffer, iv, authTag } = encryptionService.encrypt(buffer);

      // Store encrypted file
      await storageService.save(storageKey, encryptedBuffer);

      // Save metadata to DB (encryption internals stored, but not returned to client via toJSON)
      const fileDoc = await File.create({
        ownerId: req.user._id,
        originalFilename: sanitizeFilename(originalname),
        storageKey,
        mimeType: mimetype,
        size,
        iv,
        authTag,
      });

      await auditService.log({
        userId: req.user._id,
        action: 'FILE_UPLOADED',
        fileId: fileDoc._id,
        ipAddress,
        userAgent,
        success: true,
        metadata: {
          originalFilename: sanitizeFilename(originalname),
          mimeType: mimetype,
          size,
        },
      });

      res.status(201).json({
        success: true,
        data: { file: fileDoc.toJSON() },
      });
    } catch (err) {
      next(err);
    }
  },
];

/**
 * GET /api/files
 * List files owned by the authenticated user.
 */
const listFiles = async (req, res, next) => {
  try {
    const files = await File.find({
      ownerId: req.user._id,
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .lean();

    // Strip encryption metadata from list response
    const safeFiles = files.map((f) => ({
      id: f._id,
      originalFilename: f.originalFilename,
      mimeType: f.mimeType,
      size: f.size,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
      confidentialityLevel: f.confidentialityLevel || 'NORMAL',
    }));

    res.json({ success: true, data: { files: safeFiles } });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/files/:id
 * Retrieve, decrypt, and stream a file to the authorized client.
 *
 * SECURITY:
 * 1. User must be authenticated (requireAuth middleware)
 * 2. User must have file.read permission (requirePermission middleware)
 * 3. User must own this specific file (resource-level check below)
 * 4. File is decrypted server-side and streamed — no public URL exposed
 */
const getFile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { ipAddress, userAgent } = auditService.extractRequestContext(req);

    // Validate MongoDB ObjectId format
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'File not found' },
      });
    }

    const fileDoc = await File.findOne({ _id: id, isDeleted: false });

    if (!fileDoc) {
      await auditService.log({
        userId: req.user._id,
        action: 'UNAUTHORIZED_FILE_ACCESS_ATTEMPT',
        ipAddress,
        userAgent,
        success: false,
        metadata: { requestedFileId: id, reason: 'FILE_NOT_FOUND' },
      });
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'File not found' },
      });
    }

    // ─── RESOURCE-LEVEL AUTHORIZATION ─────────────────────────────────────
    // This is separate from role permission — user must OWN this file, be ADMIN,
    // or have an APPROVED access request from the owner.
    const isOwner = fileDoc.ownerId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'ADMIN';

    let hasSharedAccess = false;
    let approvedRequest = null;

    if (!isOwner && !isAdmin) {
      approvedRequest = await FileAccessRequest.findOne({
        fileId: fileDoc._id,
        requesterId: req.user._id,
        status: 'APPROVED',
      });
      if (approvedRequest) hasSharedAccess = true;
    }

    if (!isOwner && !isAdmin && !hasSharedAccess) {
      await auditService.log({
        userId: req.user._id,
        action: 'UNAUTHORIZED_FILE_ACCESS_ATTEMPT',
        fileId: fileDoc._id,
        ipAddress,
        userAgent,
        success: false,
        metadata: { reason: 'NOT_OWNER' },
      });
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' },
      });
    }

    // Read encrypted file
    const encryptedBuffer = await storageService.read(fileDoc.storageKey);

    // Decrypt — auth tag verification happens inside, throws if tampered
    const plainBuffer = encryptionService.decrypt(
      encryptedBuffer,
      fileDoc.iv,
      fileDoc.authTag
    );

    await auditService.log({
      userId: req.user._id,
      action: 'FILE_VIEWED',
      fileId: fileDoc._id,
      ipAddress,
      userAgent,
      success: true,
    });

    // Stream decrypted file with appropriate headers
    // SECURITY: No public URL — file is delivered inline, not as attachment
    res.set({
      'Content-Type': fileDoc.mimeType,
      'Content-Length': plainBuffer.length,
      // Prevent caching of sensitive content
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      // Prevent MIME sniffing
      'X-Content-Type-Options': 'nosniff',
      // Prevent embedding in iframes from other origins
      'X-Frame-Options': 'SAMEORIGIN',
      // Content disposition: inline (view, not download)
      'Content-Disposition': `inline; filename="${encodeURIComponent(fileDoc.originalFilename)}"`,
    });

    res.send(plainBuffer);

    // SECURITY: One-Time Access — Revoke after serving
    if (approvedRequest) {
      approvedRequest.status = 'EXPIRED';
      await approvedRequest.save();
    }
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/files/:id
 */
const deleteFile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { ipAddress, userAgent } = auditService.extractRequestContext(req);

    const fileDoc = await File.findOne({ _id: id, isDeleted: false });

    if (!fileDoc) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'File not found' },
      });
    }

    // Resource-level check
    const isOwner = fileDoc.ownerId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      await auditService.log({
        userId: req.user._id,
        action: 'UNAUTHORIZED_FILE_ACCESS_ATTEMPT',
        fileId: fileDoc._id,
        ipAddress,
        userAgent,
        success: false,
        metadata: { reason: 'DELETE_UNAUTHORIZED' },
      });
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' },
      });
    }

    // Soft delete metadata + physical file removal
    await File.updateOne({ _id: id }, { isDeleted: true });
    await storageService.delete(fileDoc.storageKey);

    await auditService.log({
      userId: req.user._id,
      action: 'FILE_DELETED',
      fileId: fileDoc._id,
      ipAddress,
      userAgent,
      success: true,
    });

    res.json({ success: true, message: 'File deleted' });
  } catch (err) {
    next(err);
  }
};

/**
 * Sanitize original filename for safe storage in DB.
 * Remove path components, limit length.
 */
const sanitizeFilename = (filename) => {
  return path
    .basename(filename)
    .replace(/[^a-zA-Z0-9.\-\s]/g, '_')
    .slice(0, 255);
};

/**
 * PATCH /api/files/:id/confidentiality
 * Owner or admin may update the file's confidentiality classification.
 */
const patchConfidentiality = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { level } = req.body;
    const { ipAddress, userAgent } = auditService.extractRequestContext(req);

    const VALID_LEVELS = ['NORMAL', 'CONFIDENTIAL', 'HIGHLY_CONFIDENTIAL'];
    if (!VALID_LEVELS.includes(level)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_LEVEL', message: 'Invalid confidentiality level' },
      });
    }

    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'File not found' } });
    }

    const fileDoc = await File.findOne({ _id: id, isDeleted: false });
    if (!fileDoc) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'File not found' } });
    }

    const isOwner = fileDoc.ownerId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    const previousLevel = fileDoc.confidentialityLevel;
    fileDoc.confidentialityLevel = level;
    await fileDoc.save();

    await auditService.log({
      userId: req.user._id,
      action: 'FILE_CONFIDENTIALITY_CHANGED',
      fileId: fileDoc._id,
      ipAddress,
      userAgent,
      success: true,
      metadata: { previousLevel, newLevel: level, changedByAdmin: isAdmin && !isOwner },
    });

    res.json({
      success: true,
      data: { confidentialityLevel: fileDoc.confidentialityLevel },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { uploadFile, listFiles, getFile, deleteFile, patchConfidentiality };
