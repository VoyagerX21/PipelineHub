const express = require('express');
const router = express.Router();
const { allRepo, connectRepo, getAvailableRepos } = require('../controllers/repo.js');
const { requireAuth } = require('../middleware/authMiddleware.js');

router.get("/available/:provider", requireAuth, getAvailableRepos);
router.get("/list/:userId", requireAuth, allRepo);
router.post("/connect", requireAuth, connectRepo);

module.exports = router;