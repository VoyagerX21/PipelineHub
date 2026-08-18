const Repository = require('../models/Repository.js');
const OAuthAccount = require('../models/OAuthAccount.js');
const WebhookKey = require('../models/WebhookKey.js');
const { createRepositoryWebhook, getRepoDetails, fetchUserRepositories } = require('../services/githubApiService');
const crypto = require('crypto');

const allRepo = async (req, res) => {
    try {
        const userId = req.params.userId;
        const repos = await Repository.find({ ownerId: userId });
        return res.status(200).json({
            success: true,
            repos
        });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
}

const getAvailableRepos = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const provider = req.params.provider || 'github';

        if (provider !== 'github') {
            return res.status(400).json({
                success: false,
                message: `Provider ${provider} is not supported yet for listing available repositories.`
            });
        }

        const oauthAccount = await OAuthAccount.findOne({ userId, provider });
        if (!oauthAccount || !oauthAccount.accessToken) {
            return res.status(403).json({
                success: false,
                message: `No ${provider} account linked or missing access token.`
            });
        }

        const remoteRepos = await fetchUserRepositories(oauthAccount.accessToken);

        // Fetch already connected repos from DB for this user & provider
        const connectedRepos = await Repository.find({ ownerId: userId, provider });
        const connectedSet = new Set(connectedRepos.map(r => r.fullName.toLowerCase()));

        const repos = remoteRepos.map(repo => ({
            id: repo.id.toString(),
            name: repo.name,
            fullName: repo.full_name,
            defaultBranch: repo.default_branch,
            isPrivate: repo.private,
            description: repo.description,
            htmlUrl: repo.html_url,
            alreadyConnected: connectedSet.has(repo.full_name.toLowerCase())
        }));

        return res.status(200).json({
            success: true,
            count: repos.length,
            repos
        });
    } catch (error) {
        console.error('Error fetching available repos:', error);
        return res.status(500).json({ success: false, message: error.message || 'Server Error' });
    }
};

const connectRepo = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id; // from auth middleware
        const { provider, externalRepoId, name, fullName, defaultBranch, isPrivate } = req.body;

        if (provider !== 'github') {
            return res.status(400).json({ success: false, message: 'Only GitHub is supported for auto-configuration currently.' });
        }

        // 1. Get user's OAuth access token
        const oauthAccount = await OAuthAccount.findOne({ userId, provider });
        if (!oauthAccount || !oauthAccount.accessToken) {
            return res.status(403).json({ success: false, message: `No ${provider} account linked or missing access token.` });
        }

        // 2. Fetch real repository metadata from GitHub API
        const repoDetails = await getRepoDetails(fullName, oauthAccount.accessToken);
        const resolvedExternalRepoId = repoDetails?.id ? repoDetails.id.toString() : (externalRepoId ? externalRepoId.toString() : null);
        const resolvedName = repoDetails?.name || name || fullName.split('/')[1];
        const resolvedDefaultBranch = repoDetails?.default_branch || defaultBranch || 'main';
        const resolvedIsPrivate = repoDetails ? repoDetails.private : (isPrivate ?? false);

        // 3. Generate a secure random webhook secret
        const webhookSecret = crypto.randomBytes(32).toString('hex');

        // 4. Get or create a WebhookKey for the user to form the payload URL
        let webhookKeyDoc = await WebhookKey.findOne({ userId, provider });
        if (!webhookKeyDoc) {
            webhookKeyDoc = await WebhookKey.create({
                userId,
                provider,
                key: crypto.randomBytes(16).toString('hex')
            });
        }

        // Read domain from environment with production fallback
        let domain = process.env.PUBLIC_DOMAIN || process.env.BACKEND_URL || 'https://pipelinehub.khakse.dev';
        if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
            domain = `https://${domain}`;
        }
        domain = domain.replace(/\/+$/, '');
        const payloadUrl = `${domain}/webhook/${provider}/${webhookKeyDoc.key}`;

        // 5. Configure the webhook on GitHub via API
        await createRepositoryWebhook(fullName, payloadUrl, webhookSecret, oauthAccount.accessToken);

        // 6. Save the repository in the database with the secret and resolved ID
        const repository = await Repository.findOneAndUpdate(
            { provider, fullName },
            {
                provider,
                externalRepoId: resolvedExternalRepoId,
                name: resolvedName,
                fullName,
                ownerId: userId,
                defaultBranch: resolvedDefaultBranch,
                isPrivate: resolvedIsPrivate,
                webhookSecret
            },
            { new: true, upsert: true }
        );

        return res.status(200).json({
            success: true,
            message: 'Repository connected and webhook configured successfully.',
            repository
        });
    } catch (error) {
        console.error('Error connecting repo:', error);
        return res.status(500).json({ success: false, message: error.message || 'Server Error' });
    }
}

module.exports = {
    allRepo,
    getAvailableRepos,
    connectRepo
}