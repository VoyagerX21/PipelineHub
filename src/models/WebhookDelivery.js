const mongoose = require("mongoose");

const webhookDeliverySchema = new mongoose.Schema(
  {
    webhookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Webhook",
      required: true,
    },

    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },

    status: {
      type: String,
      enum: ["success", "failed"],
      required: true,
    },

    responseCode: Number,
    responseTimeMs: Number,

    retries: {
      type: Number,
      default: 0
    },

    deliveredAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

webhookDeliverySchema.index({ webhookId: 1 });
webhookDeliverySchema.index({ eventId: 1 });

module.exports = mongoose.model("WebhookDelivery", webhookDeliverySchema);