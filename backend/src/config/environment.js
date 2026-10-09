'use strict';

/**
 * Environment configuration with validation.
 * All secrets come from environment variables — never hardcoded.
 */

const required = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`[Config] Missing required environment variable: ${key}`);
  }
  return value;
};

const optional = (key, defaultValue) => process.env[key] || defaultValue;

const config = {
  port: parseInt(optional('PORT', '5000'), 10),
  nodeEnv: optional('NODE_ENV', 'development'),
  isProduction: optional('NODE_ENV', 'development') === 'production',

  db: {
    uri: required('MONGODB_URI'),
  },

  jwt: {
    secret: required('JWT_SECRET'),
    accessExpiresIn: optional('JWT_ACCESS_EXPIRES_IN', '15m'),
    refreshExpiresIn: optional('JWT_REFRESH_EXPIRES_IN', '7d'),
  },

  smtp: {
    host: required('SMTP_HOST'),
    port: parseInt(optional('SMTP_PORT', '587'), 10),
    secure: optional('SMTP_SECURE', 'false') === 'true',
    user: required('SMTP_USER'),
    password: required('SMTP_PASSWORD'),
    from: required('SMTP_FROM'),
  },

  encryption: {
    // AES-256 master key as 64-char hex string (32 bytes)
    // NEVER stored in DB. Loaded once from env at startup.
    masterKeyHex: required('AES_MASTER_KEY'),
    get masterKey() {
      const keyBuffer = Buffer.from(this.masterKeyHex, 'hex');
      if (keyBuffer.length !== 32) {
        throw new Error('[Config] AES_MASTER_KEY must be 64 hex characters (32 bytes)');
      }
      return keyBuffer;
    },
  },

  cors: {
    frontendUrl: required('FRONTEND_URL'),
  },

  rateLimit: {
    windowMs: parseInt(optional('RATE_LIMIT_WINDOW_MS', '900000'), 10),
    max: parseInt(optional('RATE_LIMIT_MAX', '100'), 10),
    otpMax: parseInt(optional('OTP_RATE_LIMIT_MAX', '3'), 10),
  },

  otp: {
    expiryMinutes: parseInt(optional('OTP_EXPIRY_MINUTES', '5'), 10),
    maxAttempts: parseInt(optional('OTP_MAX_ATTEMPTS', '5'), 10),
  },

  upload: {
    maxFileSizeBytes: parseInt(optional('MAX_FILE_SIZE_MB', '10'), 10) * 1024 * 1024,
    allowedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'],
    allowedExtensions: ['.pdf', '.png', '.jpg', '.jpeg'],
  },
};

module.exports = config;
