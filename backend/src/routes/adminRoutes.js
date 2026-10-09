'use strict';

const router = require('express').Router();
const adminController = require('../controllers/adminController');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');

// All admin routes require authentication + admin permission
router.use(requireAuth);
router.use(requireAdmin);

router.get('/users', adminController.listUsers);
router.get('/audit', adminController.getAuditLogs);
router.get('/files', adminController.listAllFiles);
router.get('/stats', adminController.getStats);

module.exports = router;
