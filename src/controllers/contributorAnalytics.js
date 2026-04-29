/**
 * Analytics Controller
 * Provides endpoints to view contribution analytics and statistics
 */

const { getTopContributors } = require('../services/contributorService');
const Repository = require('../models/Repository');
const Contributor = require('../models/Contributor');

/**
 * Get top contributors for a repository
 * GET /analytics/contributors/:repositoryId?limit=10
 */
const getRepositoryTopContributors = async (req, res) => {
    try {
        const { repositoryId } = req.params;
        const limit = Math.min(parseInt(req.query.limit) || 10, 100);

        const repository = await Repository.findById(repositoryId);
        if (!repository) {
            return res.status(404).json({ message: 'Repository not found' });
        }

        const contributors = await getTopContributors(repositoryId, limit);

        return res.status(200).json({
            repository: {
                id: repository._id,
                name: repository.name,
                fullName: repository.fullName,
                provider: repository.provider
            },
            topContributors: contributors.map(c => ({
                userId: c.userId?._id || null,
                name: c.userId?.name || c.contributorName || c.platformUsername,
                email: c.userId?.email || c.contributorEmail || null,
                avatar: c.userId?.avatarUrl || c.contributorAvatarUrl || null,
                platform: c.platform,
                platformUsername: c.platformUsername,
                isVerified: c.isVerified,
                commits: c.commitCount,
                pullRequests: c.pullRequestCount,
                firstContributed: c.firstContributedAt,
                lastContributed: c.lastContributedAt
            })),
            total: contributors.length
        });
    } catch (err) {
        console.error('Error getting repository contributors:', err);
        return res.status(500).json({ message: 'Error fetching contributors', error: err.message });
    }
};

/**
 * Get all repositories where a user is a contributor
 * GET /analytics/user/:userId/repositories
 */
const getUserContributionsByRepositories = async (req, res) => {
    try {
        const { userId } = req.params;

        const contributions = await Contributor.find({ userId })
            .populate('userId', 'name email avatarUrl')
            .populate('repositoryId', 'name fullName provider');

        const repos = contributions.map(c => ({
            repository: {
                id: c.repositoryId._id,
                name: c.repositoryId.name,
                fullName: c.repositoryId.fullName,
                provider: c.repositoryId.provider
            },
            commits: c.commitCount,
            pullRequests: c.pullRequestCount,
            lastContributed: c.lastContributedAt,
            firstContributed: c.firstContributedAt
        }));

        return res.status(200).json({
            userId,
            userName: contributions[0]?.userId.name || 'Unknown',
            repositoriesContributedTo: repos,
            total: repos.length,
            totalCommits: repos.reduce((sum, r) => sum + r.commits, 0),
            totalPullRequests: repos.reduce((sum, r) => sum + r.pullRequests, 0)
        });
    } catch (err) {
        console.error('Error getting user contributions:', err);
        return res.status(500).json({ message: 'Error fetching user contributions', error: err.message });
    }
};

/**
 * Get detailed contributor stats for a specific user in a specific repository
 * GET /analytics/contributor/:userId/:repositoryId
 */
const getContributorDetailedStats = async (req, res) => {
    try {
        const { userId, repositoryId } = req.params;

        const contributor = await Contributor.findOne({ userId, repositoryId })
            .populate('userId', 'name email avatarUrl')
            .populate('repositoryId', 'name fullName provider');

        if (!contributor) {
            return res.status(404).json({ message: 'Contributor not found in this repository' });
        }

        return res.status(200).json({
            contributor: {
                userId: contributor.userId?._id || null,
                name: contributor.userId?.name || contributor.contributorName || contributor.platformUsername,
                email: contributor.userId?.email || contributor.contributorEmail || null,
                avatar: contributor.userId?.avatarUrl || contributor.contributorAvatarUrl || null,
                platform: contributor.platform,
                platformUsername: contributor.platformUsername,
                isVerified: contributor.isVerified
            },
            repository: {
                id: contributor.repositoryId._id,
                name: contributor.repositoryId.name,
                fullName: contributor.repositoryId.fullName,
                provider: contributor.repositoryId.provider
            },
            statistics: {
                commitCount: contributor.commitCount,
                pullRequestCount: contributor.pullRequestCount,
                branchesCreated: contributor.branchesCreated || [],
                firstContributedAt: contributor.firstContributedAt,
                lastContributedAt: contributor.lastContributedAt,
                createdAt: contributor.createdAt
            }
        });
    } catch (err) {
        console.error('Error getting contributor stats:', err);
        return res.status(500).json({ message: 'Error fetching contributor stats', error: err.message });
    }
};

/**
 * Get repository contribution summary
 * Shows breakdown of contributions by user
 * GET /analytics/repository/:repositoryId/summary
 */
const getRepositoryContributionSummary = async (req, res) => {
    try {
        const { repositoryId } = req.params;

        const repository = await Repository.findById(repositoryId);
        if (!repository) {
            return res.status(404).json({ message: 'Repository not found' });
        }

        const contributors = await Contributor.find({ repositoryId })
            .populate('userId', 'name email avatarUrl')
            .sort({ commitCount: -1 });

        const totalCommits = contributors.reduce((sum, c) => sum + c.commitCount, 0);
        const totalPRs = contributors.reduce((sum, c) => sum + c.pullRequestCount, 0);

        return res.status(200).json({
            repository: {
                id: repository._id,
                name: repository.name,
                fullName: repository.fullName,
                provider: repository.provider
            },
            summary: {
                totalContributors: contributors.length,
                totalCommits,
                totalPullRequests: totalPRs,
                contributorBreakdown: contributors.map(c => ({
                    name: c.userId?.name || c.contributorName || c.platformUsername,
                    email: c.userId?.email || c.contributorEmail || null,
                    avatar: c.userId?.avatarUrl || c.contributorAvatarUrl || null,
                    isVerified: c.isVerified,
                    commits: c.commitCount,
                    pullRequests: c.pullRequestCount,
                    commitPercentage: totalCommits > 0
                        ? ((c.commitCount / totalCommits) * 100).toFixed(2) + '%'
                        : '0.00%',
                    lastContributed: c.lastContributedAt
                }))
            }
        });
    } catch (err) {
        console.error('Error getting repository summary:', err);
        return res.status(500).json({ message: 'Error fetching repository summary', error: err.message });
    }
};

module.exports = {
    getRepositoryTopContributors,
    getUserContributionsByRepositories,
    getContributorDetailedStats,
    getRepositoryContributionSummary
};
