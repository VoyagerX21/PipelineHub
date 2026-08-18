const WebhookDelivery = require('../models/WebhookDelivery.js');
const Webhook = require('../models/Webhook.js');

const handlegetActivity = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

        const webhook = await Webhook.findOne({ userId });

        if (!webhook) {
            const result = Array.from({ length: 7 }, (_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - (6 - i));
                return {
                    date: d.toLocaleDateString("en-US", { weekday: "short" }),
                    count: 0
                };
            });
            return res.json(result);
        }

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
    } catch (err) {
        console.error("handlegetActivity error:", err);
        res.status(500).json({ error: "Failed to fetch activity" });
    }
};

const handlegetActivityGlobal = async (req, res) => {
    try {
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
    } catch (err) {
        console.error("handlegetActivityGlobal error:", err);
        res.status(500).json({ error: "Failed to fetch global activity" });
    }
};

const handlegetHealth = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const webhook = await Webhook.findOne({ userId });

        if (!webhook) {
            return res.json({
                status: "healthy",
                lastNotification: null,
                lastFailure: null,
                avgResponseMs: null
            });
        }

        const lastSuccess = await WebhookDelivery
            .findOne({ status: "success", webhookId: webhook._id })
            .sort({ createdAt: -1 });

        const lastFailure = await WebhookDelivery
            .findOne({ status: "failed", webhookId: webhook._id })
            .sort({ createdAt: -1 });

        const avg = await WebhookDelivery.aggregate([
            { $match: { responseTimeMs: { $exists: true }, webhookId: webhook._id } },
            {
                $group: {
                    _id: null,
                    avgResponseMs: { $avg: "$responseTimeMs" }
                }
            }
        ]);

        res.json({
            status: lastFailure && Date.now() - lastFailure.createdAt < 5 * 60 * 1000
                ? "degraded"
                : "healthy",

            lastNotification: lastSuccess?.createdAt || null,
            lastFailure: lastFailure?.createdAt || null,
            avgResponseMs: avg[0]?.avgResponseMs ? Math.round(avg[0].avgResponseMs) : null
        });
    } catch (err) {
        console.error("handlegetHealth error:", err);
        res.status(500).json({ error: "Failed to fetch health" });
    }
};

const handlegetHealthGlobal = async (req, res) => {
    try {
        const lastSuccess = await WebhookDelivery
            .findOne({ status: "success" })
            .sort({ createdAt: -1 });

        const lastFailure = await WebhookDelivery
            .findOne({ status: "failed" })
            .sort({ createdAt: -1 });

        const avg = await WebhookDelivery.aggregate([
            { $match: { responseTimeMs: { $exists: true } } },
            {
                $group: {
                    _id: null,
                    avgResponseMs: { $avg: "$responseTimeMs" }
                }
            }
        ]);

        res.json({
            status: lastFailure && Date.now() - lastFailure.createdAt < 5 * 60 * 1000
                ? "degraded"
                : "healthy",

            lastNotification: lastSuccess?.createdAt || null,
            lastFailure: lastFailure?.createdAt || null,
            avgResponseMs: avg[0]?.avgResponseMs ? Math.round(avg[0].avgResponseMs) : null
        });
    } catch (err) {
        console.error("handlegetHealthGlobal error:", err);
        res.status(500).json({ error: "Failed to fetch global health" });
    }
};

const handlegetRecent = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const webhook = await Webhook.findOne({ userId });

        if (!webhook) {
            return res.json([]);
        }

        const deliveries = await WebhookDelivery
            .find({ webhookId: webhook._id })
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        const formatted = deliveries.map(d => ({
            id: d._id,
            event: d.event || "webhook",
            status: d.status,
            time: d.createdAt,
            channel: d.channel || null,
            responseCode: d.responseCode,
            responseTimeMs: d.responseTimeMs
        }));

        res.json(formatted);
    } catch (err) {
        console.error("handlegetRecent error:", err);
        res.status(500).json({ error: "Failed to fetch recent deliveries" });
    }
};

const handlegetWebhooks = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const webhooks = await Webhook.find({ userId });
        if (!webhooks || webhooks.length === 0) {
            return res.json([]);
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
                    url: wh.targetUrl,
                    events: wh.subscribedEvents || [],
                    status: wh.isEnabled ? "active" : "inactive",
                    deliveries,
                    lastDelivery: last?.createdAt || null
                };
            })
        );

        res.json(result);
    } catch (err) {
        console.error("handlegetWebhooks error:", err);
        res.status(500).json({ error: "Failed to fetch webhooks" });
    }
};

const handlegetSummary = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;

        const webhook = await Webhook.findOne({ userId });

        if (!webhook) {
            return res.json({
                totalSent: 0,
                successRate: "0%",
                activeWebhooks: 0,
                failures24h: 0
            });
        }

        const totalSent = await WebhookDelivery.countDocuments({
            webhookId: webhook._id
        });

        const success = await WebhookDelivery.countDocuments({
            status: "success", 
            webhookId: webhook._id
        });

        const activeWebhooks = await Webhook.countDocuments({
            isEnabled: true, 
            userId
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
    } catch (err) {
        console.error("handlegetSummary error:", err);
        res.status(500).json({ error: "Failed to fetch summary" });
    }
};

const handlegetSummaryGlobal = async (req, res) => {
    try {
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
    } catch (err) {
        console.error("handlegetSummaryGlobal error:", err);
        res.status(500).json({ error: "Failed to fetch global summary" });
    }
};

module.exports = {
    handlegetActivity,
    handlegetHealth,
    handlegetSummary,
    handlegetRecent,
    handlegetWebhooks,
    handlegetSummaryGlobal,
    handlegetActivityGlobal,
    handlegetHealthGlobal
};