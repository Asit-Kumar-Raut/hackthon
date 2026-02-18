/**
 * CrowdLog model - Stores crowd detection and restricted area events
 * Fields: detectedCount, restrictedViolation, timestamp
 */

const mongoose = require('mongoose');

const crowdLogSchema = new mongoose.Schema(
  {
    detectedCount: {
      type: Number,
      required: true,
      default: 0,
    },
    restrictedViolation: {
      type: Boolean,
      default: false,
    },
    alertTriggered: {
      type: Boolean,
      default: false,
    },
    recordedBy: {
      type: String,
      default: null,
      comment: 'Head employee ID who was viewing the dashboard',
    },
  },
  { timestamps: true }
);

crowdLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('CrowdLog', crowdLogSchema);
