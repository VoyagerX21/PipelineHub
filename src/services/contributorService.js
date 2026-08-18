/**
 * Contributor Service
 * Handles contributor tracking with OAuth-only user creation.
 */

const User = require('../models/User');
const Contributor = require('../models/Contributor');
const OAuthAccount = require('../models/OAuthAccount');
const { extractPusher } = require('../utils/extractPusher');

/**
 * Resolve an existing verified user from webhook pusher metadata.
 * NOTE: This NEVER creates a User. Users are only created through OAuth.
 */
const findVerifiedUserFromPusher = async (platform, pusherInfo) => {
    if (!pusherInfo) return null;

    try {
        let account = null;

        if (pusherInfo.platformId) {
            account = await OAuthAccount.findOne({
                provider: platform,
                providerUserId: pusherInfo.platformId
            }).populate('userId');
        }

        if (!account && pusherInfo.username) {
            account = await OAuthAccount.findOne({
                provider: platform,
                username: pusherInfo.username
            }).populate('userId');
        }

        if (!account && pusherInfo.email) {
            const user = await User.findOne({ email: pusherInfo.email });
            if (user) {
                account = await OAuthAccount.findOne({
                    userId: user._id,
                    provider: platform
                }).populate('userId');
            }
        }

        return account?.userId || null;
    } catch (err) {
        console.error(`[${platform}] Error resolving verified user from pusher:`, err);
        return null;
    }
};

/**
 * Track contributor for a repository.
 * Unknown pushers are stored as unverified contributors.
 * Verified linkage happens when matching OAuth account exists.
 */
const trackContribution = async (payload, repositoryId, platform, eventType = 'push') => {
    if (!repositoryId) {
        return null;
    }

    try {
        const pusherInfo = extractPusher(payload, platform);
        if (!pusherInfo) return null;

        const verifiedUser = await findVerifiedUserFromPusher(platform, pusherInfo);
        const isVerified = Boolean(verifiedUser);

        let lookup = null;

        if (isVerified && pusherInfo.platformId) {
            lookup = {
                repositoryId,
                platform,
                platformUserId: pusherInfo.platformId
            };
        } else if (isVerified && pusherInfo.username) {
            lookup = {
                repositoryId,
                platform,
                platformUsername: pusherInfo.username
            };
        } else if (isVerified) {
            lookup = {
                repositoryId,
                userId: verifiedUser._id
            };
        } else if (pusherInfo.platformId) {
            lookup = {
                repositoryId,
                platform,
                platformUserId: pusherInfo.platformId
            };
        } else if (pusherInfo.username) {
            lookup = {
                repositoryId,
                platform,
                platformUsername: pusherInfo.username
            };
        } else if (pusherInfo.email) {
            lookup = {
                repositoryId,
                platform,
                contributorEmail: pusherInfo.email.toLowerCase()
            };
        }

        if (!lookup) return null;

        let contributor = await Contributor.findOne(lookup);

        if (!contributor) {
            contributor = await Contributor.create({
                userId: isVerified ? verifiedUser._id : null,
                repositoryId,
                platform,
                platformUsername: pusherInfo.username || pusherInfo.name || 'unknown',
                platformUserId: pusherInfo.platformId,
                contributorName: pusherInfo.name,
                contributorEmail: pusherInfo.email,
                contributorAvatarUrl: pusherInfo.avatarUrl,
                isVerified,
                commitCount: eventType === 'push' ? 1 : 0,
                pullRequestCount: eventType === 'pull_request' ? 1 : 0
            });
            console.log(
                `[${platform}] Tracked ${isVerified ? 'verified' : 'unverified'} contributor ${pusherInfo.username || pusherInfo.name || 'unknown'} for repo ${repositoryId}`
            );
        } else {
            if (eventType === 'push') {
                contributor.commitCount = (contributor.commitCount || 0) + 1;
            } else if (eventType === 'pull_request') {
                contributor.pullRequestCount = (contributor.pullRequestCount || 0) + 1;
            }

            if (!contributor.userId && isVerified) {
                contributor.userId = verifiedUser._id;
                contributor.isVerified = true;
            }

            contributor.platformUsername = pusherInfo.username || contributor.platformUsername;
            contributor.platformUserId = pusherInfo.platformId || contributor.platformUserId;
            contributor.contributorName = pusherInfo.name || contributor.contributorName;
            contributor.contributorEmail = (pusherInfo.email || contributor.contributorEmail || '').toLowerCase() || contributor.contributorEmail;
            contributor.contributorAvatarUrl = pusherInfo.avatarUrl || contributor.contributorAvatarUrl;
            contributor.lastContributedAt = new Date();

            await contributor.save();
        }

        return {
            contributor,
            pusherInfo,
            verifiedUser
        };
    } catch (err) {
        console.error(`[${platform}] Error in trackContribution:`, err);
        return null;
    }
};

/**
 * Mark matching contributor records as verified after OAuth login.
 */
const verifyContributorsForOAuthUser = async ({
    userId,
    platform,
    providerUserId,
    username,
    email,
    avatarUrl,
    name
}) => {
    if (!userId || !platform) return { matched: 0, modified: 0 };

    const or = [];

    if (providerUserId) {
        or.push({ platformUserId: providerUserId });
    }
    if (username) {
        or.push({ platformUsername: username });
    }
    if (email) {
        or.push({ contributorEmail: email.toLowerCase() });
    }

    if (or.length === 0) return { matched: 0, modified: 0 };

    const update = {
        userId,
        isVerified: true
    };

    if (providerUserId) update.platformUserId = providerUserId;
    if (username) update.platformUsername = username;
    if (email) update.contributorEmail = email.toLowerCase();
    if (avatarUrl) update.contributorAvatarUrl = avatarUrl;
    if (name) update.contributorName = name;

    const result = await Contributor.updateMany(
        {
            platform,
            $and: [
                {
                    $or: [
                        { userId: { $exists: false } },
                        { userId: null }
                    ]
                },
                {
                    $or: or
                }
            ]
        },
        {
            $set: update
        }
    );

    return {
        matched: result.matchedCount || 0,
        modified: result.modifiedCount || 0
    };
};

/**
 * Get top contributors for a repository
 */
const getTopContributors = async (repositoryId, limit = 10) => {
    try {
        const contributors = await Contributor.find({ repositoryId })
            .populate('userId', 'name email avatarUrl')
            .sort({ commitCount: -1, pullRequestCount: -1 })
            .limit(limit);

        return contributors;
    } catch (err) {
        console.error('Error getting top contributors:', err);
        return [];
    }
};

/**
 * Get contributor statistics for a user in a repository
 */
const getContributorStats = async (userId, repositoryId) => {
    try {
        const contributor = await Contributor.findOne({ userId, repositoryId })
            .populate('userId', 'name email avatarUrl');

        return contributor;
    } catch (err) {
        console.error('Error getting contributor stats:', err);
        return null;
    }
};

module.exports = {
    trackContribution,
    verifyContributorsForOAuthUser,
    getTopContributors,
    getContributorStats
};
