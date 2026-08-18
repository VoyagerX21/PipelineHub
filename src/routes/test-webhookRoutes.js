// Import required dependencies
const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

router.post('/:platform', (req, res, next) => {
    const platform = req.params.platform;
    req.platform = platform;
    next();
}, webhookController.handleEvent);

// Export the router for use in the main application
module.exports = router;