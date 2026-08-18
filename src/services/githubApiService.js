const axios = require('axios');

/**
 * Creates a webhook on a GitHub repository using the GitHub REST API.
 * @param {string} repoFullName - e.g., "owner/repo"
 * @param {string} payloadUrl - The URL GitHub should send events to
 * @param {string} secret - The secret used to sign the webhook payloads
 * @param {string} accessToken - The user's GitHub OAuth access token
 * @returns {Promise<Object>} - The created webhook data
 */
const createRepositoryWebhook = async (repoFullName, payloadUrl, secret, accessToken) => {
    try {
        const response = await axios.post(
            `https://api.github.com/repos/${repoFullName}/hooks`,
            {
                name: 'web',
                active: true,
                events: ['push', 'pull_request'],
                config: {
                    url: payloadUrl,
                    content_type: 'json',
                    secret: secret,
                    insecure_ssl: '0'
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: 'application/vnd.github+json',
                    'User-Agent': 'PipelineHub-App',
                    'X-GitHub-Api-Version': '2022-11-28'
                }
            }
        );
        
        return response.data;
    } catch (error) {
        console.error('Failed to create GitHub webhook:', error.response?.data || error.message);
        throw new Error(`GitHub Webhook Creation Failed: ${error.response?.data?.message || error.message}`);
    }
};

/**
 * Fetches repository details from GitHub REST API.
 * @param {string} repoFullName - e.g., "owner/repo"
 * @param {string} accessToken - The user's GitHub OAuth access token
 * @returns {Promise<Object|null>} - The repository data or null on failure
 */
const getRepoDetails = async (repoFullName, accessToken) => {
    try {
        const response = await axios.get(
            `https://api.github.com/repos/${repoFullName}`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: 'application/vnd.github+json',
                    'User-Agent': 'PipelineHub-App',
                    'X-GitHub-Api-Version': '2022-11-28'
                }
            }
        );
        return response.data;
    } catch (error) {
        console.error('Failed to fetch GitHub repo details:', error.response?.data || error.message);
        return null;
    }
};

/**
 * Fetches all repositories accessible by the authenticated user from GitHub REST API.
 * @param {string} accessToken - The user's GitHub OAuth access token
 * @param {number} page - Optional page number (default 1)
 * @param {number} perPage - Optional per page count (default 100)
 * @returns {Promise<Array>} - List of repositories
 */
const fetchUserRepositories = async (accessToken, page = 1, perPage = 100) => {
    try {
        const response = await axios.get(
            `https://api.github.com/user/repos?affiliation=owner,collaborator,organization_member&sort=updated&per_page=${perPage}&page=${page}`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: 'application/vnd.github+json',
                    'User-Agent': 'PipelineHub-App',
                    'X-GitHub-Api-Version': '2022-11-28'
                }
            }
        );
        return response.data;
    } catch (error) {
        console.error('Failed to fetch user repositories from GitHub:', error.response?.data || error.message);
        throw new Error(`GitHub API Error: ${error.response?.data?.message || error.message}`);
    }
};

module.exports = {
    createRepositoryWebhook,
    getRepoDetails,
    fetchUserRepositories
};
