'use strict';

const router = require('express').Router();
const shareController = require('../controllers/shareController');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

// All share routes require authentication
router.use(requireAuth);

router.get('/global', requirePermission('file.read'), shareController.getGlobalFiles);
router.post('/request/:fileId', requirePermission('file.read'), shareController.requestAccess);
router.get('/requests/incoming', requirePermission('file.read'), shareController.getIncomingRequests);
router.post('/requests/:requestId/approve', requirePermission('file.read'), shareController.approveRequest);
router.post('/requests/:requestId/deny', requirePermission('file.read'), shareController.denyRequest);

module.exports = router;
