'use strict';

const router = require('express').Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { otpLimiter, authLimiter } = require('../middleware/rateLimiter');

// Registration flow
router.post('/register/request-otp', otpLimiter, authController.requestRegisterOTP);
router.post('/register/verify-otp', authLimiter, authController.verifyRegisterOTP);

// Login flow
router.post('/login', otpLimiter, authController.loginRequestOTP);
router.post('/login/verify', authLimiter, authController.loginVerifyOTP);

// Session management
router.post('/logout', requireAuth, authController.logout);
router.post('/refresh', authController.refresh);
router.get('/me', requireAuth, authController.getMe);
router.put('/me/preferences', requireAuth, authController.updatePreferences);
router.post('/resend-otp', otpLimiter, authController.resendOTP);

module.exports = router;
