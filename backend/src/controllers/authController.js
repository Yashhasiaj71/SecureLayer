'use strict';

const Joi = require('joi');
const User = require('../models/User');
const otpService = require('../services/otpService');
const emailProvider = require('../services/emailProvider');
const tokenService = require('../services/tokenService');
const auditService = require('../services/auditService');

// ─── Validation Schemas ───────────────────────────────────────────────────────

const emailSchema = Joi.object({
  email: Joi.string().email().max(254).lowercase().required(),
});

const otpVerifySchema = Joi.object({
  email: Joi.string().email().max(254).lowercase().required(),
  otp: Joi.string().pattern(/^\d{6}$/).required(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const validate = (schema, data) => {
  const { error, value } = schema.validate(data, { abortEarly: false });
  if (error) throw { status: 400, code: 'VALIDATION_ERROR', message: error.details[0].message };
  return value;
};

const issueTokens = async (user, req, res) => {
  const { ipAddress, userAgent } = auditService.extractRequestContext(req);
  const accessToken = tokenService.generateAccessToken(user);
  const refreshToken = await tokenService.generateRefreshToken(user._id, { ipAddress, userAgent });

  // Set refresh token in HttpOnly cookie
  res.cookie('refreshToken', refreshToken, tokenService.getRefreshCookieOptions());

  return accessToken;
};

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register/request-otp
 * Rate limited by otpLimiter middleware.
 */
const requestRegisterOTP = async (req, res, next) => {
  try {
    const { email } = validate(emailSchema, req.body);
    const { ipAddress, userAgent } = auditService.extractRequestContext(req);

    // Check if email is already registered
    const existing = await User.findOne({ email });
    if (existing) {
      await auditService.log({
        action: 'OTP_REQUESTED',
        ipAddress,
        userAgent,
        success: false,
        metadata: { reason: 'EMAIL_ALREADY_REGISTERED', email },
      });
      // DEVELOPMENT MODE: Explicit error instead of silent success
      return res.status(400).json({ success: false, error: { message: 'This email is already registered. Please go back and click "Sign in instead".' } });
    }

    await otpService.requestOTP(email, 'REGISTER', emailProvider);

    await auditService.log({
      action: 'OTP_REQUESTED',
      ipAddress,
      userAgent,
      success: true,
      metadata: { purpose: 'REGISTER' },
    });

    res.json({ success: true, message: 'OTP sent to email address' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/register/verify-otp
 */
const verifyRegisterOTP = async (req, res, next) => {
  try {
    const { email, otp } = validate(otpVerifySchema, req.body);
    const { ipAddress, userAgent } = auditService.extractRequestContext(req);

    const result = await otpService.verifyOTP(email, otp, 'REGISTER');

    if (!result.valid) {
      await auditService.log({
        action: result.reason === 'OTP_EXPIRED' ? 'OTP_EXPIRED' : 'OTP_FAILED',
        ipAddress,
        userAgent,
        success: false,
        metadata: { reason: result.reason },
      });

      const messages = {
        OTP_NOT_FOUND: 'Invalid or expired OTP',
        OTP_EXPIRED: 'OTP has expired. Please request a new one.',
        OTP_MAX_ATTEMPTS: 'Too many failed attempts. Please request a new OTP.',
        OTP_INVALID: 'Invalid OTP',
      };

      return res.status(400).json({
        success: false,
        error: { code: result.reason, message: messages[result.reason] || 'Verification failed' },
      });
    }

    // Create user account
    const user = await User.create({ email });

    await auditService.log({
      userId: user._id,
      action: 'OTP_VERIFIED',
      ipAddress,
      userAgent,
      success: true,
      metadata: { purpose: 'REGISTER' },
    });

    await auditService.log({
      userId: user._id,
      action: 'USER_CREATED',
      ipAddress,
      userAgent,
      success: true,
    });

    const accessToken = await issueTokens(user, req, res);

    res.status(201).json({
      success: true,
      data: {
        accessToken,
        user: { id: user._id, email: user.email, role: user.role },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login
 * Login = request OTP for existing account
 */
const loginRequestOTP = async (req, res, next) => {
  try {
    const { email } = validate(emailSchema, req.body);
    const { ipAddress, userAgent } = auditService.extractRequestContext(req);

    const user = await User.findOne({ email, isActive: true });

    if (!user) {
      await auditService.log({
        action: 'LOGIN_FAILED',
        ipAddress,
        userAgent,
        success: false,
        metadata: { reason: 'USER_NOT_FOUND' },
      });
      // DEVELOPMENT MODE: Explicit error instead of silent success
      return res.status(400).json({ success: false, error: { message: 'Account not found. Please click "Create an account" below.' } });
    }

    await otpService.requestOTP(email, 'LOGIN', emailProvider);

    await auditService.log({
      userId: user._id,
      action: 'OTP_REQUESTED',
      ipAddress,
      userAgent,
      success: true,
      metadata: { purpose: 'LOGIN' },
    });

    res.json({ success: true, message: 'OTP sent to email address' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login/verify
 * Verify OTP and issue tokens
 */
const loginVerifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = validate(otpVerifySchema, req.body);
    const { ipAddress, userAgent } = auditService.extractRequestContext(req);

    const result = await otpService.verifyOTP(email, otp, 'LOGIN');

    if (!result.valid) {
      await auditService.log({
        action: 'OTP_FAILED',
        ipAddress,
        userAgent,
        success: false,
        metadata: { reason: result.reason, purpose: 'LOGIN' },
      });

      return res.status(400).json({
        success: false,
        error: {
          code: result.reason,
          message: result.reason === 'OTP_EXPIRED'
            ? 'OTP has expired. Please request a new one.'
            : result.reason === 'OTP_MAX_ATTEMPTS'
            ? 'Too many failed attempts. Please request a new OTP.'
            : 'Invalid OTP',
        },
      });
    }

    const user = await User.findOne({ email, isActive: true });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' },
      });
    }

    // Update login tracking
    await User.updateOne({ _id: user._id }, {
      $set: { lastLoginAt: new Date() },
      $inc: { loginCount: 1 },
    });

    await auditService.log({
      userId: user._id,
      action: 'LOGIN',
      ipAddress,
      userAgent,
      success: true,
    });

    const accessToken = await issueTokens(user, req, res);

    res.json({
      success: true,
      data: {
        accessToken,
        user: { id: user._id, email: user.email, role: user.role },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/logout
 */
const logout = async (req, res, next) => {
  try {
    const { ipAddress, userAgent } = auditService.extractRequestContext(req);
    const refreshToken = req.cookies?.refreshToken;

    if (refreshToken) {
      await tokenService.revokeToken(refreshToken);
    }

    await auditService.log({
      userId: req.user?._id,
      action: 'LOGOUT',
      ipAddress,
      userAgent,
      success: true,
    });

    // Clear the refresh token cookie
    res.clearCookie('refreshToken', { path: '/api/auth' });
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/refresh
 * Silent token refresh using HttpOnly refresh cookie
 */
const refresh = async (req, res, next) => {
  try {
    const rawToken = req.cookies?.refreshToken;
    const { ipAddress, userAgent } = auditService.extractRequestContext(req);

    if (!rawToken) {
      return res.status(401).json({
        success: false,
        error: { code: 'NO_REFRESH_TOKEN', message: 'No refresh token' },
      });
    }

    const result = await tokenService.rotateRefreshToken(rawToken, { ipAddress, userAgent });

    if (!result) {
      res.clearCookie('refreshToken', { path: '/api/auth' });
      return res.status(401).json({
        success: false,
        error: { code: 'REFRESH_TOKEN_INVALID', message: 'Invalid or expired refresh token' },
      });
    }

    const user = await User.findById(result.userId).lean();
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: { code: 'ACCOUNT_INACTIVE', message: 'Account not found or inactive' },
      });
    }

    const accessToken = tokenService.generateAccessToken(user);

    // Set rotated refresh token in cookie
    res.cookie('refreshToken', result.newRawToken, tokenService.getRefreshCookieOptions());

    await auditService.log({
      userId: user._id,
      action: 'TOKEN_REFRESHED',
      ipAddress,
      userAgent,
      success: true,
    });

    res.json({
      success: true,
      data: {
        accessToken,
        user: { id: user._id, email: user.email, role: user.role },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/me
 */
const getMe = async (req, res) => {
  res.json({
    success: true,
    data: {
      user: {
        id: req.user._id,
        email: req.user.email,
        role: req.user.role,
        createdAt: req.user.createdAt,
        lastLoginAt: req.user.lastLoginAt,
        preferences: req.user.preferences || { emailNotifications: true },
      },
    },
  });
};

/**
 * PUT /api/auth/me/preferences
 */
const updatePreferences = async (req, res, next) => {
  try {
    const { emailNotifications } = req.body;
    
    let updateData = {};
    if (typeof emailNotifications === 'boolean') {
      updateData = { 'preferences.emailNotifications': emailNotifications };
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateData },
      { new: true }
    );

    res.json({
      success: true,
      data: { preferences: updatedUser.preferences }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/resend-otp
 * Rate limited by otpLimiter middleware
 */
const resendOTP = async (req, res, next) => {
  try {
    const { email } = validate(emailSchema, req.body);
    const { ipAddress, userAgent } = auditService.extractRequestContext(req);

    // Check if there's a pending OTP to determine purpose
    const OTPVerification = require('../models/OTPVerification');
    const existing = await OTPVerification.findOne({ email });
    const purpose = existing?.purpose || 'LOGIN';

    const user = await User.findOne({ email });

    if (purpose === 'REGISTER' && user) {
      return res.json({ success: true, message: 'OTP resent if applicable' });
    }

    if (purpose === 'LOGIN' && !user) {
      return res.json({ success: true, message: 'OTP resent if applicable' });
    }

    await otpService.requestOTP(email, purpose, emailProvider);

    await auditService.log({
      userId: user?._id || null,
      action: 'OTP_REQUESTED',
      ipAddress,
      userAgent,
      success: true,
      metadata: { purpose, type: 'RESEND' },
    });

    res.json({ success: true, message: 'OTP resent if applicable' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  requestRegisterOTP,
  verifyRegisterOTP,
  loginRequestOTP,
  loginVerifyOTP,
  logout,
  refresh,
  getMe,
  updatePreferences,
  resendOTP,
};
