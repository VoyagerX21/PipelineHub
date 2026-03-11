// Import the Express framework for building the web server
const express = require('express');
const cookieParser = require("cookie-parser");

// Import webhook routes from a separate module
const webhookRoutes = require('./routes/webhookRoutes');
const testwebhook = require('./routes/test-webhookRoutes');
const authRoute = require('./routes/auth');
const events = require('./routes/events.js');
const users = require('./routes/users.js');
const analytics = require('./routes/analytics.js');
const repo = require('./routes/repo.js');
const cors = require('cors');

// Initialize the Express application
const app = express();
app.use(cors({
  origin: "https://pipelinehubb.khakse.me",
  credentials: true
}));
app.use(cookieParser());

// Initialization for the API documentation at route /api-docs using swagger.yaml
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const swaggerDocument = YAML.load('./swagger.yaml');

// Apply raw body parser middleware specifically for GitHub webhook endpoint
// to handle raw JSON payloads
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));


// Mount webhook routes under the '/webhook' path
app.use('/webhook', webhookRoutes);

// Apply JSON body parser middleware for all other routes
app.use(express.json());

// Testing webhook route
app.use('/testwebhook', testwebhook);
app.use('/auth', authRoute);
app.use('/events', events);
app.use('/user', users);
app.use('/analytics', analytics);
app.use('/repo', repo);

// Define a root route to confirm the webhook listener is running
app.get('/', (req, res) => res.send('Webhook listener running events!!'));

// Export the Express app for use in other modules (e.g., server startup)
module.exports = app;