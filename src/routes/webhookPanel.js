const express = require('express');
const router = express.Router();
const {
    handlegetActivity,
    handlegetHealth,
    handlegetRecent,
    handlegetSummary,
    handlegetWebhooks,
    handlegetSummaryGlobal,
    handlegetActivityGlobal
} = require('../controllers/webhookPanel.js');


router.get('/personal-dashboard/summary', handlegetSummary);
router.get('/personal-dashboard/activity', handlegetActivity);
router.get('/personal-dashboard/recent', handlegetRecent);
router.get('/personal-dashboard/health', handlegetHealth);
router.get('/webhooks', handlegetWebhooks);
router.get('/dashboard/summary', handlegetSummaryGlobal);
router.get('/dashboard/activity', handlegetActivityGlobal);

module.exports = router;