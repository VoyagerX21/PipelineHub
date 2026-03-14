const WebhookDelivery = require('../models/WebhookDelivery.js');
const Webhook = require('../models/Webhook.js');

const handlegetActivity = async (req, res) => {

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const data = await WebhookDelivery.aggregate([
    {
      $match: {
        createdAt: { $gte: sevenDaysAgo }
      }
    },
    {
      $group: {
        _id: { $dayOfWeek: "$createdAt" }, // 1-7
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        day: "$_id",
        count: 1
      }
    }
  ]);
  console.log(data);
  res.json(data);
};

const handlegetHealth = async (req, res) => {
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
    const deliveries = await WebhookDelivery
        .find()
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
    const webhooks = await Webhook.find().lean();

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
    const totalSent = await WebhookDelivery.countDocuments();

    const success = await WebhookDelivery.countDocuments({
        status: "success"
    });

    const activeWebhooks = await Webhook.countDocuments({
        status: "active"
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
    handlegetWebhooks
}