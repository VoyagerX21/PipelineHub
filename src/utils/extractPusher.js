/**
 * Normalize pusher information from webhook payloads
 * Handles GitHub, GitLab, and Bitbucket platforms
 * 
 * Returns: { name, email, username, avatarUrl, platformId }
 */

const extractPusherFromGitHub = (payload) => {
    // GitHub webhook format
    const pusher = payload.pusher || payload.sender;
    if (!pusher) return null;

    return {
        name: pusher.name || pusher.login,
        email: pusher.email,
        username: pusher.login,
        avatarUrl: pusher.avatar_url,
        platformId: pusher.id?.toString(),
        platform: 'github'
    };
};

const extractPusherFromGitLab = (payload) => {
    // GitLab webhook format
    if (!payload.user_username && !payload.user_name) return null;

    return {
        name: payload.user_name,
        email: payload.user_email,
        username: payload.user_username,
        avatarUrl: payload.user_avatar,
        platformId: payload.user_id?.toString(),
        platform: 'gitlab'
    };
};

const extractPusherFromBitbucket = (payload) => {
    // Bitbucket webhook format
    // Try to get from push.changes[0].new.target.author or from actor
    let author = null;

    if (payload.push?.changes?.[0]?.new?.target?.author) {
        author = payload.push.changes[0].new.target.author;
    } else if (payload.actor) {
        author = payload.actor;
    }

    if (!author) return null;

    return {
        name: author.display_name || author.user?.display_name,
        email: author.user?.email_address || author.email,
        username: author.username || author.user?.username,
        avatarUrl: author.avatar || author.user?.links?.avatar?.href,
        platformId: author.uuid || author.user?.uuid,
        platform: 'bitbucket'
    };
};

/**
 * Main function to extract pusher from any platform
 * @param {Object} payload - Webhook payload
 * @param {String} platform - Platform name (github, gitlab, bitbucket)
 * @returns {Object} Normalized pusher object
 */
const extractPusher = (payload, platform) => {
    if (!payload) return null;

    let pusher = null;

    if (platform === 'github') {
        pusher = extractPusherFromGitHub(payload);
    } else if (platform === 'gitlab') {
        pusher = extractPusherFromGitLab(payload);
    } else if (platform === 'bitbucket') {
        pusher = extractPusherFromBitbucket(payload);
    }

    return pusher;
};

module.exports = {
    extractPusher,
    extractPusherFromGitHub,
    extractPusherFromGitLab,
    extractPusherFromBitbucket
};
