const express = require('express');
const { handleLogin, getMe } = require('../controllers/auth/login');
const { githubLogin, githubCallback } = require('../controllers/auth/github.js');

const router = express.Router();

router.post("/login", handleLogin);
router.get("/github", githubLogin);
router.get("/github/callback", githubCallback);
router.get("/me", getMe);

module.exports = router;