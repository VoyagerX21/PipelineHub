
const Commit = require("../models/Commit");
const Repository = require("../models/Repository");
const Event2 = require("../models/Event2");
const User = require("../models/User");
const jwt = require("jsonwebtoken");

const analytics = async (req, res) => {
    try {
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

        const repositories = await Repository.find({ ownerId: userId }).select("_id");
        const repositoryIds = repositories.map((repo) => repo._id);

        if (!repositoryIds.length) {
            return res.status(200).json({
                totalEvents: 0,
                activeRepos: 0,
                contributors: 0,
                platforms: {
                    github: 0,
                    gitlab: 0,
                    bitbucket: 0,
                },
                types: {
                    push: 0,
                    pull_request: 0,
                    merge: 0,
                    pull: 0,
                },
                topActors: [],
            });
        }

        const [
            totalEvents,
            activeRepos,
            contributors,
            platformAgg,
            typeAgg,
            topActorAgg,
        ] = await Promise.all([
            Event2.countDocuments({ repositoryId: { $in: repositoryIds } }),
            Event2.distinct("repositoryId", { repositoryId: { $in: repositoryIds } }),
            Commit.distinct("authorEmail", { repositoryId: { $in: repositoryIds } }),
            Event2.aggregate([
                { $match: { repositoryId: { $in: repositoryIds } } },
                { $group: { _id: "$provider", count: { $sum: 1 } } },
            ]),
            Event2.aggregate([
                { $match: { repositoryId: { $in: repositoryIds } } },
                { $group: { _id: "$type", count: { $sum: 1 } } },
            ]),
            Event2.aggregate([
                { $match: { repositoryId: { $in: repositoryIds } } },
                { $group: { _id: "$senderId", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 },
            ]),
        ]);

        const platforms = {
            github: 0,
            gitlab: 0,
            bitbucket: 0,
        };

        platformAgg.forEach((item) => {
            if (item._id) {
                platforms[item._id] = item.count;
            }
        });

        const types = {
            push: 0,
            pull_request: 0,
            merge: 0,
            pull: 0,
        };

        typeAgg.forEach((item) => {
            if (item._id) {
                types[item._id] = item.count;
            }
        });

        const topActorIds = topActorAgg.map((actor) => actor._id).filter(Boolean);
        const users = await User.find({ _id: { $in: topActorIds } }).select("name email");
        const userMap = new Map(users.map((user) => [String(user._id), user]));

        const topActors = topActorAgg.map((actor) => {
            const user = userMap.get(String(actor._id));
            return {
                name: user?.name || user?.email || "unknown",
                count: actor.count,
            };
        });

        return res.status(200).json({
            totalEvents,
            activeRepos: activeRepos.length,
            contributors: contributors.filter(Boolean).length,
            platforms,
            types,
            topActors,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch analytics",
        });
    }
};

module.exports = {
    analytics
}