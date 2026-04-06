const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  platform: String,
  eventType: String,
  repository: String,
  repositoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Repository'
  },
  pusherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Keep pusher name for backward compatibility and quick reference
  pusherName: String,
  message: String,
  status: {
    type: String,
    enum: ['triggered', 'failed', 'retrying'],
    default: 'triggered'
  },
  retries: {
    type: Number,
    default: 0
  },
  lastRetry: {
    type: Date
  },
  receivedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('Event', eventSchema);