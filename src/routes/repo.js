const express = require('express');
const router = express.Router();
const { allRepo } = require('../controllers/repo.js');

router.get("/list/:userId", allRepo);

module.exports = router;