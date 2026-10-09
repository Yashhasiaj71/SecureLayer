'use strict';

const crypto = require('crypto');
const config = require('../config/environment');

/**
 * Encryption Service — AES-256-GCM authenticated encryption.
 *
 * SECURITY PRINCIPLES:
 * 1. Never invent custom cryptography — uses Node.js built-in crypto module
 * 2. Never use static IV/nonce — unique 12-byte IV per encryption operation
 * 3. Never reuse GCM nonce with same key — would catastrophically break GCM security
 * 4. Authenticate ciphertext — always verify authTag before returning plaintext
 * 5. Master key comes from environment only — never DB, never hardcoded
 *
 * KEY MANAGEMENT STRATEGY:
 * - MVP: AES_MASTER_KEY from environment variable (64 hex chars = 32 bytes)
 * - Production migration path:
 *   → Replace getKey() with AWS KMS GenerateDataKey call
 *   → Envelope encryption: per-file data key encrypted by KMS CMK
 *   → Or: use Hashicorp Vault transit engine
 * - The masterKey is loaded once at module level to fail fast on misconfiguration
 */

// Load and validate master key once at startup
const MASTER_KEY = config.encryption.masterKey;

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;      // 12 bytes = 96 bits (NIST recommended for GCM)
const AUTH_TAG_LENGTH = 16; // 16 bytes = 128 bits (maximum, most secure)

const encryptionService = {
  /**
   * Encrypt a buffer using AES-256-GCM.
   * Generates a unique IV for each call.
   *
   * @param {Buffer} plainBuffer - Data to encrypt
   * @returns {{ encryptedBuffer: Buffer, iv: string, authTag: string }}
   */
  encrypt(plainBuffer) {
    // Generate unique 12-byte IV — NEVER reuse with same key
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, MASTER_KEY, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    const encrypted = Buffer.concat([
      cipher.update(plainBuffer),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return {
      encryptedBuffer: encrypted,
      iv: iv.toString('hex'),           // Store as hex string in DB
      authTag: authTag.toString('hex'), // Store as hex string in DB
    };
  },

  /**
   * Decrypt a buffer using AES-256-GCM.
   * VERIFIES authentication tag before returning plaintext.
   * If the file has been tampered with, this will throw.
   *
   * @param {Buffer} encryptedBuffer
   * @param {string} ivHex - IV as hex string from DB
   * @param {string} authTagHex - Auth tag as hex string from DB
   * @returns {Buffer} Decrypted plaintext
   * @throws {Error} If auth tag verification fails (tampered data)
   */
  decrypt(encryptedBuffer, ivHex, authTagHex) {
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, MASTER_KEY, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    // SECURITY: Set auth tag BEFORE decryption attempt
    // GCM will verify integrity of entire ciphertext
    decipher.setAuthTag(authTag);

    try {
      const decrypted = Buffer.concat([
        decipher.update(encryptedBuffer),
        decipher.final(), // Throws if auth tag verification fails
      ]);
      return decrypted;
    } catch (err) {
      // Rethrow with a generic message — never expose crypto details
      throw new Error('Decryption failed: data integrity check failed');
    }
  },
};

module.exports = encryptionService;
