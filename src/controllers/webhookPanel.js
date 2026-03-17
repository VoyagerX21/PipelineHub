const WebhookDelivery = require('../models/WebhookDelivery.js');
const Webhook = require('../models/Webhook.js');
const jwt = require("jsonwebtoken");

const handlegetActivity = async (req, res) => {
    let userId = req.user?.userId;
    if (!userId) {
        const token = req.cookies?.token;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.userId;
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const webhook = await Webhook.findOne({ userId });

    const raw = await WebhookDelivery.aggregate([
        {
            $match: {
                createdAt: { $gte: sevenDaysAgo },
                webhookId: webhook._id
            },
        },
        {
            $group: {
                _id: {
                    $dateToString: {
                        format: "%Y-%m-%d",
                        date: "$createdAt",
                        timezone: "Asia/Kolkata"
                    }
                },
                count: { $sum: 1 }
            }
        }
    ]);

    const result = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));

        const key = d.toISOString().slice(0, 10);

        const found = raw.find(r => r._id === key);

        return {
            date: d.toLocaleDateString("en-US", { weekday: "short" }),
            count: found ? found.count : 0
        };
    });

    res.json(result);
};

const handlegetActivityGlobal = async (req, res) => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const raw = await WebhookDelivery.aggregate([
        {
            $match: {
                createdAt: { $gte: sevenDaysAgo }
            },
        },
        {
            $group: {
                _id: {
                    $dateToString: {
                        format: "%Y-%m-%d",
                        date: "$createdAt",
                        timezone: "Asia/Kolkata"
                    }
                },
                count: { $sum: 1 }
            }
        }
    ]);

    const result = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));

        const key = d.toISOString().slice(0, 10);

        const found = raw.find(r => r._id === key);

        return {
            date: d.toLocaleDateString("en-US", { weekday: "short" }),
            count: found ? found.count : 0
        };
    });

    res.json(result);
};

const handlegetHealth = async (req, res) => {
    let userId = req.user?.userId;
    if (!userId) {
        const token = req.cookies?.token;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.userId;
    }
    const webhook = await Webhook.findOne({ userId });
    const lastSuccess = await WebhookDelivery
        .findOne({ status: "success", webhookId: webhook._id })
        .sort({ createdAt: -1 });

    const lastFailure = await WebhookDelivery
        .findOne({ status: "failed", webhookId: webhook._id })
        .sort({ createdAt: -1 });

    const avg = await WebhookDelivery.aggregate([
        { $match: { responseTime: { $exists: true }, webhookId: webhook._id } },
        {
            $group: {
                _id: null,
                avgResponseMs: { $avg: "$responseTime" }
            }
        }
    ]);

    res.json({
        status: lastFailure && Date.now() - lastFailure.createdAt < 5 * 60 * 1000
            ? "degraded"
            : "healthy",

        lastNotification: lastSuccess?.createdAt || null,
        lastFailure: lastFailure?.createdAt || null,
        avgResponseMs: avg[0]?.avgResponseMs || null
    });
}

const handlegetHealthGlobal = async (req, res) => {
    const lastSuccess = await WebhookDelivery
        .findOne({ status: "success" })
        .sort({ createdAt: -1 });

    const lastFailure = await WebhookDelivery
        .findOne({ status: "failed" })
        .sort({ createdAt: -1 });

    const avg = await WebhookDelivery.aggregate([
        { $match: { responseTime: { $exists: true } } },
        {
            $group: {
                _id: null,
                avgResponseMs: { $avg: "$responseTime" }
            }
        }
    ]);

    res.json({
        status: lastFailure && Date.now() - lastFailure.createdAt < 5 * 60 * 1000
            ? "degraded"
            : "healthy",

        lastNotification: lastSuccess?.createdAt || null,
        lastFailure: lastFailure?.createdAt || null,
        avgResponseMs: avg[0]?.avgResponseMs || null
    });
}

const handlegetRecent = async (req, res) => {
    let userId = req.user?.userId;
    if (!userId) {
        const token = req.cookies?.token;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.userId;
    }
    const webhook = await Webhook.findOne({ userId });
    const deliveries = await WebhookDelivery
        .find({ webhookId: webhook._id })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

    const formatted = deliveries.map(d => ({
        id: d._id,
        event: d.event,
        status: d.status,
        time: d.createdAt,
        channel: d.channel || null
    }));

    res.json(formatted);
}

const handlegetWebhooks = async (req, res) => {
    let userId = req.user?.userId;
    if (!userId) {
        const token = req.cookies?.token;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.userId;
    }
    const webhooks = await Webhook.find({ userId });
    if (!webhooks) {
        const result = [];
        return res.json(result);
    }

    const result = await Promise.all(
        webhooks.map(async (wh) => {

            const deliveries = await WebhookDelivery.countDocuments({
                webhookId: wh._id
            });

            const last = await WebhookDelivery
                .findOne({ webhookId: wh._id })
                .sort({ createdAt: -1 });

            return {
                id: wh._id,
                name: wh.name,
                url: wh.url,
                events: wh.events,
                status: wh.status,
                deliveries,
                lastDelivery: last?.createdAt || null
            };
        })
    );

    res.json(result);
}

const handlegetSummary = async (req, res) => {
    let userId = req.user?.userId;
    if (!userId) {
        const token = req.cookies?.token;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.userId;
    }

    const webhook = await Webhook.findOne({ userId });

    const totalSent = await WebhookDelivery.countDocuments({
        webhookId: webhook._id
    });

    const success = await WebhookDelivery.countDocuments({
        status: "success", webhookId: webhook._id
    });

    const activeWebhooks = await Webhook.countDocuments({
        isEnabled: true, userId
    });

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const failures24h = await WebhookDelivery.countDocuments({
        status: "failed",
        createdAt: { $gte: dayAgo },
        webhookId: webhook._id
    });

    const successRate = totalSent > 0
        ? ((success / totalSent) * 100).toFixed(1) + "%"
        : "0%";

    res.json({
        totalSent,
        successRate,
        activeWebhooks,
        failures24h
    });
}

const handlegetSummaryGlobal = async (req, res) => {
    const totalSent = await WebhookDelivery.countDocuments();

    const success = await WebhookDelivery.countDocuments({
        status: "success"
    });

    const activeWebhooks = await Webhook.countDocuments({
        isEnabled: true
    });

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const failures24h = await WebhookDelivery.countDocuments({
        status: "failed",
        createdAt: { $gte: dayAgo }
    });

    const successRate = totalSent > 0
        ? ((success / totalSent) * 100).toFixed(1) + "%"
        : "0%";

    res.json({
        totalSent,
        successRate,
        activeWebhooks,
        failures24h
    });
}

module.exports = {
    handlegetActivity,
    handlegetHealth,
    handlegetSummary,
    handlegetRecent,
    handlegetWebhooks,
    handlegetSummaryGlobal,
    handlegetActivityGlobal,
    handlegetHealthGlobal
}