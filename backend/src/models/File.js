'use strict';

const mongoose = require('mongoose');

/**
 * File metadata schema.
 * SECURITY NOTES:
 * - storageKey is a UUID-based filename — never the original filename
 * - iv and authTag are stored here (not secret, but needed for decryption)
 * - The AES master key is NEVER stored in this document or anywhere in DB
 * - encryptionVersion allows future key rotation
 * - originalFilename is stored for UX but never used in filesystem paths
 */
const fileSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    originalFilename: {
      type: String,
      required: true,
      // UX only — never used in filesystem paths
    },
    storageKey: {
      type: String,
      required: true,
      unique: true,
      // UUID-based filename on disk, e.g. "a3f2c1d4-...-.enc"
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
      // Original file size in bytes (before encryption)
    },
    encryptionAlgorithm: {
      type: String,
      default: 'aes-256-gcm',
    },
    encryptionVersion: {
      type: Number,
      default: 1,
      // Allows future key rotation/algorithm migration
    },
    iv: {
      type: String,
      required: true,
      // Hex string — 12 bytes = 24 hex chars. Not secret, needed for decryption.
    },
    authTag: {
      type: String,
      required: true,
      // Hex string — 16 bytes = 32 hex chars. GCM authentication tag.
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        // SECURITY: Strip encryption internals from API responses
        delete ret.storageKey;
        delete ret.iv;
        delete ret.authTag;
        delete ret.encryptionAlgorithm;
        delete ret.encryptionVersion;
        delete ret.__v;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('File', fileSchema);
