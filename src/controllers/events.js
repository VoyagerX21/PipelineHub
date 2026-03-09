const Event2 = require("../models/Event2");

const getlist = async (req, res) => {
  try {
    const userId = req.params.userId;

    const events = await Event2.find({
      userId
    })
      .populate("repositoryId", "name")
      .populate("senderId", "username")
      .sort({ eventTimestamp: -1 })
      .limit(100);

    return res.json({
      success: true,
      count: events.length,
      events
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch events"
    });
  }
};

module.exports = {
  getlist
};