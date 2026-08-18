const WebhookKey = require("../models/WebhookKey");
const Repository = require('../models/Repository');
const Event2 = require("../models/Event2");
const Commit = require("../models/Commit");

const getUserFromWebhookKey = async (platform, key) => {
    const webhook = await WebhookKey.findOne({
        key,
        provider: platform
    }).populate("userId");

    if (!webhook) {
        throw new Error("Invalid webhook key");
    }
    return webhook.userId;
};

const upsertRepository = async (platform, payload, ownerId) => {
    let repoData = {};

    if (platform === "github") {
        repoData = {
            provider: "github",
            externalRepoId: payload.repository.id.toString(),
            name: payload.repository.name,
            fullName: payload.repository.full_name,
            ownerId,
            defaultBranch: payload.repository.default_branch,
            isPrivate: payload.repository.private
        };
    }

    if (platform === "gitlab") {
        repoData = {
            provider: "gitlab",
            externalRepoId: payload.project.id.toString(),
            name: payload.project.name,
            fullName: payload.project.path_with_namespace,
            ownerId,
            defaultBranch: payload.project.default_branch,
            isPrivate: payload.project.visibility !== "public"
        };
    }

    if (platform === "bitbucket") {
        repoData = {
            provider: "bitbucket",
            externalRepoId: payload.repository.uuid,
            name: payload.repository.name,
            fullName: payload.repository.full_name,
            ownerId,
            defaultBranch: payload.push?.changes[0]?.new?.name,
            isPrivate: payload.repository.is_private
        };
    }

    return await Repository.findOneAndUpdate(
        { provider: repoData.provider, externalRepoId: repoData.externalRepoId },
        repoData,
        { upsert: true, new: true }
    );
};

const createEvent = async (
    platform,
    normalizedType,
    payload,
    repositoryId,
    senderId,
    rawEvent
) => {
    return await Event2.create({
        provider: platform,
        type: normalizedType,
        rawEvent,
        repositoryId,
        senderId,
        branch:
            payload.ref ||
            payload.object_attributes?.source_branch ||
            payload.pullrequest?.source?.branch?.name ||
            payload.push?.changes[0]?.new?.name,

        before: payload.before,
        after: payload.after,

        eventTimestamp: new Date(),
        rawPayload: payload
    });
};

const createCommitsIfAny = async (
    platform,
    payload,
    repositoryId,
    eventId
) => {
    let commits = [];

    if (platform === "github" && payload.commits) {
        commits = payload.commits.map(c => ({
            commitId: c.id,
            repositoryId,
            eventId,
            message: c.message,
            authorName: c.author?.name,
            authorEmail: c.author?.email,
            authorDate: c.timestamp,
            addedFiles: c.added || [],
            removedFiles: c.removed || [],
            modifiedFiles: c.modified || []
        }));
    }

    if (platform === "gitlab" && payload.commits) {
        commits = payload.commits.map(c => ({
            commitId: c.id,
            repositoryId,
            eventId,
            message: c.message,
            authorName: c.author?.name,
            authorEmail: c.author?.email,
            authorDate: c.timestamp,
            addedFiles: c.added || [],
            removedFiles: c.removed || [],
            modifiedFiles: c.modified || []
        }));
    }

    if (platform === "bitbucket" && payload.push?.changes) {
        payload.push.changes.forEach(change => {
            change.commits?.forEach(c => {
                commits.push({
                    commitId: c.hash,
                    repositoryId,
                    eventId,
                    message: c.message,
                    authorName: c.author?.user?.display_name,
                    authorEmail: null,
                    authorDate: c.date,
                    addedFiles: [],
                    removedFiles: [],
                    modifiedFiles: []
                });
            });
        });
    }

    if (commits.length > 0) {
        await Commit.insertMany(commits, { ordered: false });
    }
};

module.exports = {
    getUserFromWebhookKey,
    upsertRepository,
    createEvent,
    createCommitsIfAny
};
