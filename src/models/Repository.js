const mongoose = require('mongoose');

const repositorySchema = new mongoose.Schema(
    {
        provider: {
            type: String,
            enum: ["github", "gitlab", "bitbucket"],
            required: true,
        },

        externalRepoId: {
            type: String,
            required: true,
        },

        name: {
            type: String,
            required: true,
        },

        fullName: {
            type: String,
            required: true,
        },

        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        defaultBranch: String,
        isPrivate: Boolean,
        webhookSecret: {
            type: String
        }
    },
    { timestamps: true }
);

repositorySchema.index(
    { provider: 1, externalRepoId: 1 },
    { unique: true }
);

module.exports = mongoose.model("Repository", repositorySchema);