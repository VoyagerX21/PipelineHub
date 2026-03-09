const mongoose = require("mongoose");

const webhookKeySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  provider: {
    type: String,
    enum: ["github", "gitlab", "bitbucket"],
    required: true
  },

  key: {
    type: String,
    unique: true,
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model("WebhookKey", webhookKeySchema);