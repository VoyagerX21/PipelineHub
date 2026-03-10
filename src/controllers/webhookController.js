// Import required dependencies
const pipelineService = require('../services/pipelineService');
const Event = require('../models/Event');
const verifySignature = require('../utils/verifySignature');
const { sendNotification } = require('../services/notificationService');
const Event2 = require("../models/Event2");
const Commit = require("../models/Commit");
const Repository = require('../models/Repository');
const WebhookKey = require("../models/WebhookKey");
const User = require("../models/User");
const { processEvent } = require('../services/eventProcessor');

// Handles incoming GitHub webhook events
const handleGitHubWebhook = async (req, res) => {
    const platform = req.platform;
    const secret = process.env.WEBHOOK_SECRET; // Webhook secret from environment variables // GitHub event type from headers
    let isValid = false;

    // Parse incoming request body as JSON
    let json;
    try {
        json = JSON.parse(req.body.toString());
    } catch (err) {
        return res.status(400).json({ message: 'Invalid JSON' });
    }

    // Step 1: Verify webhook signature for security
    if (platform === 'github') {
        isValid = verifySignature.verifyGitHubSignature(req, secret);
    } else if (platform === 'gitlab') {
        isValid = verifySignature.verifyGitLabSignature(req, secret);
    } else if (platform === 'bitbucket') {
        isValid = true; // or custom logic
    }
    if (!isValid) return res.status(401).send('Invalid signature');
    const event = req.headers['x-github-event'] || req.headers['x-gitlab-event'] || req.headers['x-event-key'];

    const supportedEvents = {
        github: ['push', 'pull_request', 'merge', 'workflow_run'],

        gitlab: [
            'Push Hook',
            'Tag Push Hook',
            'Merge Request Hook',
            'Pipeline Hook'
        ],

        bitbucket: [
            'repo:push',
            'pullrequest:created',
            'pullrequest:updated',
            'pullrequest:merged'
        ]
    };

    // Step 2: Filter for supported GitHub events
    if (!supportedEvents[platform]?.includes(event)) {
        console.log(`[${platform}] ${event} event ignored`);
        return res.status(200).json({
            message: `Event ${event} ignored`
        });
    }

    // Step 3: Trigger CI/CD pipeline and log event
    try {
        // console.log(json);
        console.log(req.body);
        await pipelineService.triggerPipeline(event, json, platform);
        await Event.create({
            platform: platform,
            eventType: event,
            repository: json.repository?.full_name,
            pusher: json.pusher?.name,
            message: json.head_commit?.message,
            status: 'triggered'
        });
        return res.status(200).json({ message: `Pipeline triggered for ${event}` });
    }
    catch (err) {
        // Log failed pipeline trigger
        await Event.create({
            platform: platform,
            eventType: event,
            repository: json.repository?.full_name,
            pusher: json.pusher?.name,
            message: json.head_commit?.message,
            status: 'failed',
            retries: 0,
            lastRetry: new Date()
        });
        await sendNotification(`❌ Pipeline failed for event: *${event}* in *${json.repository?.full_name}*`);
        return res.status(500).json({ message: 'Pipeline trigger failed' });
    }
};

const normalizeEventType = (platform, rawEvent, payload) => {
    if (platform === "github") {
        if (rawEvent === "push") return "push";

        if (rawEvent === "pull_request") {
            if (
                payload.action === "closed" &&
                payload.pull_request?.merged
            ) return "merge";
            return "pull_request";
        }

        if (rawEvent === "workflow_run") return "pipeline";
    }

    if (platform === "gitlab") {
        if (rawEvent === "Push Hook") return "push";
        if (rawEvent === "Tag Push Hook") return "tag_push";

        if (rawEvent === "Merge Request Hook") {
            if (payload.object_attributes?.state === "merged")
                return "merge";
            return "pull_request";
        }

        if (rawEvent === "Pipeline Hook") return "pipeline";
    }

    if (platform === "bitbucket") {
        if (rawEvent === "repo:push") return "push";

        if (rawEvent === "pullrequest:merged") return "merge";

        if (
            rawEvent === "pullrequest:created" ||
            rawEvent === "pullrequest:updated"
        ) return "pull_request";
    }

    return null;
};

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

const handleEvent = async (req, res) => {
    try {
        const platform = req.platform;
        const key = req.params.key;
        const secret = process.env.WEBHOOK_SECRET;
        
        let isValid = false;
        let rawEvent;

        if (platform === "github"){
            rawEvent = req.headers["x-github-event"];
            // isValid = verifySignature.verifyGitHubSignature(req, secret);
        } else if (platform === "gitlab"){
            rawEvent = req.headers["x-gitlab-event"];
            // isValid = verifySignature.verifyGitLabSignature(req, secret);
        } else if (platform === "bitbucket"){
            rawEvent = req.headers["x-event-key"];
            // isValid = verifySignature.verifyGitHubSignature(req, secret);
        }
        
        // if (!isValid){
        //     console.log(`[${platform}] Signature verification failed`);
        //     return res.status(401).json({msg: "Signature verification failed"});
        // }

        let payload;
        try {
            const bodyBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);
            payload = JSON.parse(bodyBuffer.toString());
        } catch (err) {
            console.error(`[${platform}] Failed to parse payload:`, err.message);
            return res.status(400).json({msg: "Invalid JSON payload"});
        }

        const normalizedType = normalizeEventType(
            platform,
            rawEvent,
            payload
        );

        // console.log(normalizedType);

        if (!normalizedType) {
            console.log(`[${platform}] Ignored event: ${rawEvent}`);
            return res.status(200).json({
                message: `Event ${rawEvent} ignored`
            });
        }

        const user = await getUserFromWebhookKey(platform, key);
        if (!user) {
            return res.status(401).json({ message: "Invalid webhook key" });
        }
        
        const repository = await upsertRepository(
            platform,
            payload,
            user._id
        );

        const event = await createEvent(
            platform,
            normalizedType,
            payload,
            repository._id,
            user._id,
            rawEvent
        );

        if (normalizedType === "push") {
            await createCommitsIfAny(
                platform,
                payload,
                repository._id,
                event._id
            );
        }

        await processEvent(event, payload, user, repository);

        console.log(
            `[${platform}] Processed ${normalizedType} event successfully`
        );

        return res.status(200).json({
            message: "Event processed successfully"
        });

    } catch (error) {
        console.error(`Webhook Error: `, error);
        return res.status(500).json({
            message: "Internal Server Error",
            error: error.message
        });
    }
}

// Retrieves pipeline event history
const getPipelineStatus = async (req, res) => {
    try {
        // Fetch all events, sorted by most recent
        const events = await Event.find().sort({ createdAt: -1 });
        return res.status(200).json({
            count: events.length,
            events: events.map(e => ({
                platfrom: e.platform,
                type: e.eventType,
                repository: e.repository,
                pusher: e.pusher,
                message: e.message,
                status: e.status,
                receivedAt: e.receivedAt
            }))
        });
    }
    catch (err) {
        console.error("Failed to fetch status: ", err);
        return res.status(500).json({ message: "Server error" });
    }
}

// Export controller functions
module.exports = { handleGitHubWebhook, getPipelineStatus, handleEvent };