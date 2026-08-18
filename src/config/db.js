const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI); // Get the URL from the .env and connection
        console.log('Connected to MongoDB');
    }
    catch (err) {
        console.error("MongoDB connection error: ", err);
        process.exit(1);
    }
}

module.exports = connectDB;