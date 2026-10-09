'use strict';

const fs = require('fs').promises;
const path = require('path');

/**
 * Storage Service — abstraction layer for file I/O.
 *
 * Current implementation: LocalEncryptedStorage
 * Migration path: Replace with S3EncryptedStorage by swapping the provider.
 *
 * SECURITY:
 * - Storage directory is NOT under express.static() — never publicly served
 * - File keys are UUID-based — no user input in filesystem paths
 * - Path traversal prevented: storageKey is validated to contain no path separators
 */

// Resolve storage path relative to project root, not CWD
const STORAGE_ROOT = path.resolve(__dirname, '../../storage/private');

/**
 * Validate that a storage key doesn't contain path traversal sequences.
 * @param {string} key
 * @throws {Error} if key is suspicious
 */
const validateStorageKey = (key) => {
  if (!key || typeof key !== 'string') {
    throw new Error('Invalid storage key');
  }
  // Only allow UUID pattern + .enc extension
  if (!/^[0-9a-f-]{36}\.enc$/.test(key)) {
    throw new Error('Invalid storage key format');
  }
};

const storageService = {
  /**
   * Save an encrypted buffer to private storage.
   * @param {string} key - UUID-based filename (e.g. "uuid.enc")
   * @param {Buffer} buffer - Encrypted file data
   */
  async save(key, buffer) {
    validateStorageKey(key);
    const filePath = path.join(STORAGE_ROOT, key);

    // Ensure the resolved path is within storage root (defense against traversal)
    if (!filePath.startsWith(STORAGE_ROOT)) {
      throw new Error('Storage path traversal detected');
    }

    await fs.mkdir(STORAGE_ROOT, { recursive: true });
    await fs.writeFile(filePath, buffer);
  },

  /**
   * Read an encrypted buffer from private storage.
   * @param {string} key
   * @returns {Promise<Buffer>}
   */
  async read(key) {
    validateStorageKey(key);
    const filePath = path.join(STORAGE_ROOT, key);

    if (!filePath.startsWith(STORAGE_ROOT)) {
      throw new Error('Storage path traversal detected');
    }

    return fs.readFile(filePath);
  },

  /**
   * Delete a file from private storage.
   * @param {string} key
   */
  async delete(key) {
    validateStorageKey(key);
    const filePath = path.join(STORAGE_ROOT, key);

    if (!filePath.startsWith(STORAGE_ROOT)) {
      throw new Error('Storage path traversal detected');
    }

    try {
      await fs.unlink(filePath);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      // File already gone — not an error
    }
  },

  /**
   * Check if a file exists in storage.
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async exists(key) {
    validateStorageKey(key);
    const filePath = path.join(STORAGE_ROOT, key);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  },
};

module.exports = storageService;
