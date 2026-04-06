const mongoose = require('mongoose');

const ContributorSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    repositoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Repository',
        required: true
    },
    platform: {
        type: String,
        enum: ['github', 'gitlab', 'bitbucket'],
        required: true
    },
    platformUsername: {
        type: String,
        required: true
    },
    platformUserId: {
        type: String
    },
    contributorName: {
        type: String
    },
    contributorEmail: {
        type: String,
        lowercase: true,
        trim: true
    },
    contributorAvatarUrl: {
        type: String
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    commitCount: {
        type: Number,
        default: 1
    },
    pullRequestCount: {
        type: Number,
        default: 0
    },
    branchesCreated: [String],
    lastContributedAt: {
        type: Date,
        default: Date.now
    },
    firstContributedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// One verified contributor record per user per repository.
ContributorSchema.index(
    { repositoryId: 1, userId: 1 },
    {
        unique: true,
        partialFilterExpression: { userId: { $exists: true, $ne: null } }
    }
);

// One unverified/verified record per provider identity in a repository.
ContributorSchema.index(
    { repositoryId: 1, platform: 1, platformUserId: 1 },
    {
        unique: true,
        partialFilterExpression: { platformUserId: { $exists: true, $type: 'string' } }
    }
);

module.exports = mongoose.model("Contributor", ContributorSchema);