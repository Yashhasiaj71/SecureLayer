'use strict';

const mongoose = require('mongoose');

/**
 * Temporary OTP storage.
 * - OTP value is NEVER stored plaintext — only bcrypt hash
 * - TTL index auto-deletes expired records
 * - One record per email (upsert pattern)
 */
const otpVerificationSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
      index: true,
    },
    hashedOtp: {
      type: String,
      required: true,
      // SECURITY: This is the bcrypt hash — not the plaintext OTP
    },
    expiresAt: {
      type: Date,
      required: true,
      // TTL index ensures MongoDB auto-deletes expired OTPs
      index: { expires: 0 },
    },
    attempts: {
      type: Number,
      default: 0,
    },
    purpose: {
      type: String,
      enum: ['REGISTER', 'LOGIN'],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('OTPVerification', otpVerificationSchema);
