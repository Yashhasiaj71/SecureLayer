'use strict';

const mongoose = require('mongoose');
const { ROLES } = require('../utils/rbacDefinitions');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.USER,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    loginCount: {
      type: Number,
      default: 0,
    },
    preferences: {
      emailNotifications: {
        type: Boolean,
        default: true,
      }
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        // Never expose internal MongoDB fields unnecessarily
        delete ret.__v;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('User', userSchema);
