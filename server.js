// configured the .env
const dotenv = require('dotenv');
dotenv.config();

const app = require('./src/app');


// Initialize BullMQ Workers
require('./src/workers/webhookWorker');
require('./src/workers/pipelineWorker');
require('./src/workers/notificationWorker');
require('./src/workers/outgoingWebhookWorker');

// connection of MongoDB
const connectDB = require('./src/config/db');
connectDB();

// Starting the server at the PORT 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});