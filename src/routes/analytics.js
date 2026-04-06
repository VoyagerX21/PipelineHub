const express = require('express');
const router = express.Router()
const { analytics } = require('../controllers/analytics.js');
const {
	getRepositoryTopContributors,
	getUserContributionsByRepositories,
	getContributorDetailedStats,
	getRepositoryContributionSummary
} = require('../controllers/contributorAnalytics');

// Existing endpoint
router.get('/user', analytics);

// ============ Contributor Analytics Endpoints ============

/**
 * Get top contributors for a repository
 * GET /analytics/contributors/:repositoryId?limit=10
 */
router.get('/contributors/:repositoryId', getRepositoryTopContributors);

/**
 * Get contribution summary for a repository
 * Shows breakdown of contributions by user
 * GET /analytics/repository/:repositoryId/summary
 */
router.get('/repository/:repositoryId/summary', getRepositoryContributionSummary);

/**
 * Get all repositories where a user contributed
 * GET /analytics/user/:userId/repositories
 */
router.get('/user/:userId/repositories', getUserContributionsByRepositories);

/**
 * Get detailed stats for a contributor in a specific repository
 * GET /analytics/contributor/:userId/:repositoryId
 */
router.get('/contributor/:userId/:repositoryId', getContributorDetailedStats);

module.exports = router;