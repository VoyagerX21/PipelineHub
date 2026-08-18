const mongoose = require("mongoose");

const commitSchema = new mongoose.Schema(
  {
    commitId: {
      type: String,
      required: true,
      unique: true,
    },

    repositoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Repository",
      required: true,
    },

    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },

    message: String,

    authorName: String,
    authorEmail: String,
    authorDate: Date,

    addedFiles: [String],
    removedFiles: [String],
    modifiedFiles: [String],
  },
  { timestamps: true }
);

commitSchema.index({ repositoryId: 1 });
commitSchema.index({ authorEmail: 1 });

module.exports = mongoose.model("Commit", commitSchema);