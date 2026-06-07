const express = require('express');
const { handleLogin, getMe, getProviders, forgotPass, authenticateChangePass, updatePass } = require('../controllers/auth/login.js');
const { githubLogin, githubCallback } = require('../controllers/auth/github.js');
const { gitlabLogin, gitlabCallback } = require('../controllers/auth/gitlab.js');
const { bitbucketLogin, bitbucketCallback } = require('../controllers/auth/bitbucket.js');

const router = express.Router();

router.post("/login", handleLogin);
router.get("/github", githubLogin);
router.get("/github/callback", githubCallback);
router.get("/gitlab", gitlabLogin);
router.get("/gitlab/callback", gitlabCallback);
router.get("/bitbucket", bitbucketLogin);
router.get("/bitbucket/callback", bitbucketCallback);
router.get("/me", getMe);
router.get("/providers/:userId", getProviders);
router.post("/forgot", forgotPass);
router.get("/verify/forgot/:token", authenticateChangePass);
router.post("/updatePass", updatePass)

module.exports = router;