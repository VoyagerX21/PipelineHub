const express = require('express');
const { getlist } = require('../controllers/events.js');
const router = express.Router();

router.get('/list/:userId', getlist);

module.exports = router;