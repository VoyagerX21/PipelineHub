const express = require('express');
const router = express.Router()
const { analytics } = require('../controllers/analytics.js');

router.get('/user', analytics);

module.exports = router;