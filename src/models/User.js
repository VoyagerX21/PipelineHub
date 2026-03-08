const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
        provider: {
            type: String,
            enum: ["github", "gitlab", "bitbucket"],
            required: true,
        },

        externalId: {
            type: String,
            required: true,
        },

        username: {
            type: String,
            required: true,
        },
        password: {
            type: String,
            default: ""
        },

        email: String,
        avatarUrl: String,
        profileUrl: String,
    },
    {
        timestamps: true
    }
);

userSchema.index({ provider: 1, externalId: 1 }, { unique: true });

module.exports = mongoose.model("User", userSchema);