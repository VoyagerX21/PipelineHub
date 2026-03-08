const express = require('express');
const { getlist } = require('../controllers/events.js');
const router = express.Router();

router.get('/list/:username', getlist);

module.exports = router;