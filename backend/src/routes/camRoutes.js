'use strict';

const router = require('express').Router();
const camController = require('../controllers/camController');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

router.use(requireAuth);

/**
 * POST /api/cam/audit
 * Receive structured CamDetection session events from the browser client.
 * Validates event type, verifies file access, and records to audit log.
 */
router.post('/audit', requirePermission('file.read'), camController.logCamEvent);

module.exports = router;
