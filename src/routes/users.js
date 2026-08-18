const express = require('express');
const router = express.Router();
const { updateUserConfig, updatePass } = require('../controllers/users.js');

router.post('/updateConfig/:userId', updateUserConfig);
router.post('/updatePass/:userId', updatePass);

module.exports = router;