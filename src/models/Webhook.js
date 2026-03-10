const mongoose = require("mongoose");

const webhookSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    name: {
      type: String,
      required: true,
    },

    targetUrl: {
      type: String,
      required: true,
    },

    subscribedEvents: {
      type: [String],
      default: ["push", "merge", "pull_request", "pipeline"]
    },

    providers: [
      {
        type: String,
        enum: ["github", "gitlab", "bitbucket"],
      },
    ],

    isEnabled: {
      type: Boolean,
      default: true,
    },

    deliveryCount: {
      type: Number,
      default: 0,
    },

    lastTriggeredAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Webhook", webhookSchema);