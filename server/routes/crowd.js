const express = require('express');
const router = express.Router();
const crowdController = require('../controllers/crowdController');
const { requireRole } = require('../middleware/auth');

router.get('/data', requireRole('head'), crowdController.getCrowdData);
router.post('/log', requireRole('head'), crowdController.logCrowd);
router.post('/restricted-area', requireRole('head'), crowdController.createRestrictedArea);

module.exports = router;
