'use strict';

const router = require('express').Router();
const fileController = require('../controllers/fileController');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

// All file routes require authentication
router.use(requireAuth);

router.post('/upload', requirePermission('file.upload'), fileController.uploadFile);
router.get('/', requirePermission('file.read'), fileController.listFiles);
router.get('/:id', requirePermission('file.read'), fileController.getFile);
router.delete('/:id', requirePermission('file.delete.own'), fileController.deleteFile);
router.patch('/:id/confidentiality', requirePermission('file.upload'), fileController.patchConfidentiality);

module.exports = router;
