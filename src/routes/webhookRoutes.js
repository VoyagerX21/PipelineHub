// Import required dependencies
const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// Define route for handling incoming GitHub webhook events
router.post('/:platform/:key', express.raw({ type: "*/*" }), (req, res, next) =>{
    const platform = req.params.platform;
    req.platform = platform;
    next();
}, webhookController.handleEvent);

// Define route for retrieving pipeline status history
router.get('/status', webhookController.getPipelineStatus);

// Export the router for use in the main application
module.exports = router;