const express = require('express');
const router = express.Router();
const {
    handlegetActivity,
    handlegetHealth,
    handlegetRecent,
    handlegetSummary,
    handlegetWebhooks
} = require('../controllers/webhookPanel.js');


router.get('/dashboard/summary', handlegetSummary);
router.get('/dashboard/activity', handlegetActivity);
router.get('/dashboard/recent', handlegetRecent);
router.get('/dashboard/health', handlegetHealth);
router.get('/webhooks', handlegetWebhooks);

module.exports = router;