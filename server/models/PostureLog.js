/**
 * PostureLog model - Stores posture monitoring events per employee
 * Fields: employeeId, postureStatus, duration, score, timestamp
 */

const mongoose = require('mongoose');

const postureLogSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: true,
      index: true,
    },
    postureStatus: {
      type: String,
      enum: ['good', 'bad'],
      required: true,
    },
    duration: {
      type: Number,
      default: 0,
      comment: 'Duration in seconds (e.g. bad posture duration)',
    },
    score: {
      type: Number,
      default: 0,
    },
    eventType: {
      type: String,
      enum: ['status_update', 'alert_triggered', 'session_start', 'session_end'],
      default: 'status_update',
    },
  },
  { timestamps: true }
);

postureLogSchema.index({ employeeId: 1, createdAt: -1 });

module.exports = mongoose.model('PostureLog', postureLogSchema);
