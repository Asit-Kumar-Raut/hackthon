const express = require('express');
const router = express.Router();
const postureController = require('../controllers/postureController');
const { requireRole } = require('../middleware/auth');

router.get('/data', requireRole('employee'), postureController.getPostureData);
router.post('/log', requireRole('employee'), postureController.logPosture);

module.exports = router;
