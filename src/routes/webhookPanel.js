const express = require('express');
const router = express.Router();
const {
    handlegetActivity,
    handlegetHealth,
    handlegetRecent,
    handlegetSummary,
    handlegetWebhooks,
    handlegetSummaryGlobal,
    handlegetActivityGlobal,
    handlegetHealthGlobal
} = require('../controllers/webhookPanel.js');


const { requireAuth } = require('../middleware/authMiddleware');

router.get('/personal-dashboard/summary', requireAuth, handlegetSummary);
router.get('/personal-dashboard/activity', requireAuth, handlegetActivity);
router.get('/personal-dashboard/recent', requireAuth, handlegetRecent);
router.get('/personal-dashboard/health', requireAuth, handlegetHealth);
router.get('/webhooks', requireAuth, handlegetWebhooks);
router.get('/dashboard/summary', handlegetSummaryGlobal);
router.get('/dashboard/activity', handlegetActivityGlobal);
router.get('/dashboard/health', handlegetHealthGlobal);

module.exports = router;