const mongoose = require("mongoose");

const oauthAccountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    provider: {
      type: String,
      enum: ["github", "gitlab", "bitbucket"],
      required: true
    },

    providerUserId: {
      type: String,
      required: true
    },

    username: {
      type: String
    },

    avatarUrl: {
      type: String
    },

    profileUrl: {
      type: String
    },

    accessToken: {
      type: String
    },

    refreshToken: {
      type: String
    },

    tokenExpiresAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

oauthAccountSchema.index(
  { provider: 1, providerUserId: 1 },
  { unique: true }
);

module.exports = mongoose.model("OAuthAccount", oauthAccountSchema);