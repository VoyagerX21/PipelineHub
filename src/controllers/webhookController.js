const verifySignature = require('../utils/verifySignature');
const Event2 = require("../models/Event2");



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

const Repository = require("../models/Repository");

const handleEvent = async (req, res) => {
    try {
        const platform = req.platform;
        const key = req.params.key;
        
        let rawEvent;
        const bodyBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);

        let payload;
        try {
            payload = JSON.parse(bodyBuffer.toString());
        } catch (err) {
            console.error(`[${platform}] Failed to parse payload:`, err.message);
            return res.status(400).json({msg: "Invalid JSON payload"});
        }

        // Extract repository ID and full name based on platform
        let externalRepoId = null;
        let repoFullName = null;

        if (platform === "github" && payload.repository) {
            externalRepoId = payload.repository.id ? payload.repository.id.toString() : null;
            repoFullName = payload.repository.full_name;
        } else if (platform === "gitlab" && payload.project) {
            externalRepoId = payload.project.id ? payload.project.id.toString() : null;
            repoFullName = payload.project.path_with_namespace;
        } else if (platform === "bitbucket" && payload.repository) {
            externalRepoId = payload.repository.uuid;
            repoFullName = payload.repository.full_name;
        }

        // Retrieve dynamic webhook secret from DB, fallback to ENV
        let secret = process.env.WEBHOOK_SECRET;
        let repo = null;

        if (externalRepoId) {
            repo = await Repository.findOne({ provider: platform, externalRepoId });
        }

        if (!repo && repoFullName) {
            repo = await Repository.findOne({
                provider: platform,
                fullName: new RegExp(`^${repoFullName}$`, 'i')
            });
        }

        if (repo && repo.webhookSecret) {
            secret = repo.webhookSecret;
            // Sync externalRepoId if it wasn't set or was different
            if (externalRepoId && repo.externalRepoId !== externalRepoId) {
                repo.externalRepoId = externalRepoId;
                await repo.save();
            }
        }

        let isValid = false;

        if (platform === "github"){
            rawEvent = req.headers["x-github-event"];
            isValid = verifySignature.verifyGitHubSignature(req, secret);
        } else if (platform === "gitlab"){
            rawEvent = req.headers["x-gitlab-event"];
            isValid = verifySignature.verifyGitLabSignature(req, secret);
        } else if (platform === "bitbucket"){
            rawEvent = req.headers["x-event-key"];
            isValid = req.headers["x-hub-signature-256"] 
                ? verifySignature.verifyGitHubSignature(req, secret) 
                : Boolean(key && key !== "default");
        }
        
        if (!isValid){
            console.log(`[${platform}] Signature verification failed`);
            return res.status(401).json({msg: "Signature verification failed"});
        }

        const normalizedType = normalizeEventType(
            platform,
            rawEvent,
            payload
        );

        if (!normalizedType) {
            console.log(`[${platform}] Ignored event: ${rawEvent}`);
            return res.status(200).json({
                message: `Event ${rawEvent} ignored`
            });
        }

        const { enqueueWebhookEvent } = require('../queues/webhookQueue');

        await enqueueWebhookEvent({
            platform,
            key,
            rawEvent,
            normalizedType,
            payload
        });

        console.log(
            `[${platform}] Event ${normalizedType} queued for processing`
        );

        return res.status(202).json({
            message: "Event queued for processing"
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
        // Fetch all events (latest first) + populate useful refs
        const events = await Event2
            .find()
            .sort({ eventTimestamp: -1 })
            .populate("repositoryId", "name")   // only get repo name
            .populate("senderId", "username");  // only get user name

        return res.status(200).json({
            count: events.length,
            events: events.map(e => ({
                provider: e.provider,
                type: e.type,
                repository: e.repositoryId?.name || null,
                sender: e.senderId?.username || null,

                branch: e.branch,
                before: e.before,
                after: e.after,

                forced: e.forced,
                created: e.created,
                deleted: e.deleted,

                slackStatus: e.slackStatus,

                eventTimestamp: e.eventTimestamp,
                createdAt: e.createdAt
            }))
        });

    } catch (err) {
        console.error("Failed to fetch status: ", err);
        return res.status(500).json({ message: "Server error" });
    }
};

// Export controller functions
module.exports = { 
    getPipelineStatus, 
    handleEvent
};