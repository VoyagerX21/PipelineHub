const express = require('express');
const router = express.Router();
const { updateUserConfig } = require('../controllers/users.js');

router.post('/updateConfig/:userId', updateUserConfig);

module.exports = router;