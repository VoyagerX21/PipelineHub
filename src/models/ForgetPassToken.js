const mongoose = require("mongoose");

const tokenSchema = new mongoose.Schema({

    userId: {
        type: mongoose.Types.ObjectId,
        required: true
    },

    token: {
        type: String,
        required: true
    },

    status: {
        type: String,
        default: "unused"
    }

}, { timestamps: true });

module.exports = mongoose.model("Token", tokenSchema);