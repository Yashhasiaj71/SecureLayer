'use strict';

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const OTPVerification = require('../models/OTPVerification');
const config = require('../config/environment');

/**
 * OTP Service — abstracts OTP lifecycle.
 * The provider (email, SMS, etc.) is injected, making this transport-agnostic.
 *
 * SECURITY:
 * - OTP generated with crypto.randomInt (CSPRNG)
 * - Only bcrypt hash stored — never plaintext
 * - OTP never logged, never returned in API responses
 * - Previous OTPs invalidated on new request (upsert)
 */
const OTP_BCRYPT_ROUNDS = 10;

/**
 * Generate a cryptographically secure 6-digit OTP.
 * Uses crypto.randomInt which uses CSPRNG.
 * @returns {string} Zero-padded 6-digit string
 */
const generateSecureOTP = () => {
  // Range: 0 to 999999 inclusive → pad to 6 digits
  const otp = crypto.randomInt(0, 1000000);
  return otp.toString().padStart(6, '0');
};

const otpService = {
  /**
   * Generate, hash, and store an OTP for the given email.
   * Invalidates any existing OTP for the same email (upsert).
   *
   * @param {string} email
   * @param {'REGISTER'|'LOGIN'} purpose
   * @param {Object} emailProvider - Object with sendOTP(email, otp) method
   * @returns {Promise<void>}
   */
  async requestOTP(email, purpose, emailProvider) {
    const otp = generateSecureOTP();
    // SECURITY: Hash before storage — never store plaintext OTP
    const hashedOtp = await bcrypt.hash(otp, OTP_BCRYPT_ROUNDS);

    const expiresAt = new Date(
      Date.now() + config.otp.expiryMinutes * 60 * 1000
    );

    // Upsert — invalidates any existing OTP for this email
    await OTPVerification.findOneAndUpdate(
      { email },
      {
        email,
        hashedOtp,
        expiresAt,
        attempts: 0,
        purpose,
      },
      { upsert: true, new: true }
    );

    // Send via provider (email, SMS, etc.)
    await emailProvider.sendOTP(email, otp);
    // SECURITY: otp variable goes out of scope here — not returned or logged
  },

  /**
   * Verify submitted OTP against stored hash.
   * Increments attempt counter on failure.
   * Deletes record on success.
   *
   * @param {string} email
   * @param {string} submittedOtp
   * @param {'REGISTER'|'LOGIN'} purpose
   * @returns {Promise<{ valid: boolean, reason?: string }>}
   */
  async verifyOTP(email, submittedOtp, purpose) {
    const record = await OTPVerification.findOne({ email, purpose });

    if (!record) {
      return { valid: false, reason: 'OTP_NOT_FOUND' };
    }

    if (new Date() > record.expiresAt) {
      await OTPVerification.deleteOne({ email });
      return { valid: false, reason: 'OTP_EXPIRED' };
    }

    if (record.attempts >= config.otp.maxAttempts) {
      await OTPVerification.deleteOne({ email });
      return { valid: false, reason: 'OTP_MAX_ATTEMPTS' };
    }

    const isValid = await bcrypt.compare(submittedOtp, record.hashedOtp);

    if (!isValid) {
      // Increment attempt counter — do not delete, allow retry up to maxAttempts
      await OTPVerification.updateOne({ email }, { $inc: { attempts: 1 } });
      return { valid: false, reason: 'OTP_INVALID' };
    }

    // Success — delete the OTP record (one-time use)
    await OTPVerification.deleteOne({ email });
    return { valid: true };
  },
};

module.exports = otpService;
