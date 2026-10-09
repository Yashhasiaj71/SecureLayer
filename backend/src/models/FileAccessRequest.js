'use strict';

const mongoose = require('mongoose');

const fileAccessRequestSchema = new mongoose.Schema(
  {
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'File',
      required: true,
    },
    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'DENIED', 'EXPIRED'],
      default: 'PENDING',
    },
  },
  { timestamps: true }
);

// A user can only have one active/pending/approved request per file
fileAccessRequestSchema.index({ fileId: 1, requesterId: 1 }, { unique: true });

module.exports = mongoose.model('FileAccessRequest', fileAccessRequestSchema);
