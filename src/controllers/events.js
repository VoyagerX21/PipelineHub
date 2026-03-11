const Event2 = require("../models/Event2");

const getlist = async (req, res) => {
  try {
    const userId = req.params.userId;

    const events = await Event2.find({senderId: userId })
      .populate("repositoryId", "name")
      .populate("senderId", "name")
      .sort({ eventTimestamp: -1 });

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