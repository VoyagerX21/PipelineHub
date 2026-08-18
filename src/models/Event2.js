const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ["github", "gitlab", "bitbucket"],
      required: true,
    },

    type: {
      type: String,
      required: true,
    },

    repositoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Repository",
      required: true,
    },

    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    branch: String,
    before: String,
    after: String,

    forced: Boolean,
    created: Boolean,
    deleted: Boolean,

    slackStatus: {
      type: String,
      enum: ["pending", "notified", "failed"],
      default: "pending",
    },

    eventTimestamp: {
      type: Date,
      required: true,
    },

    rawPayload: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

eventSchema.index({ repositoryId: 1, eventTimestamp: -1 });
eventSchema.index({ senderId: 1 });
eventSchema.index({ provider: 1, type: 1 });
eventSchema.index({ eventTimestamp: -1 });

module.exports = mongoose.model("Event2", eventSchema);