/**
 * Contributor Analytics Routes
 * Provides endpoints for viewing contribution data and statistics
 */

const express = require('express');
const router = express.Router();
const {
    getRepositoryTopContributors,
    getUserContributionsByRepositories,
    getContributorDetailedStats,
    getRepositoryContributionSummary
} = require('../controllers/contributorAnalytics');

/**
 * Get top contributors for a repository
 * GET /api/analytics/repository/:repositoryId/top-contributors?limit=10
 */
router.get('/repository/:repositoryId/top-contributors', getRepositoryTopContributors);

/**
 * Get all repositories where a user contributed
 * GET /api/analytics/user/:userId/repositories
 */
router.get('/user/:userId/repositories', getUserContributionsByRepositories);

/**
 * Get detailed stats for a contributor in a specific repository
 * GET /api/analytics/contributor/:userId/:repositoryId
 */
router.get('/contributor/:userId/:repositoryId', getContributorDetailedStats);

/**
 * Get contribution summary for a repository
 * GET /api/analytics/repository/:repositoryId/summary
 */
router.get('/repository/:repositoryId/summary', getRepositoryContributionSummary);

module.exports = router;
