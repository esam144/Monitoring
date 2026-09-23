import mongoose from 'mongoose';

const websiteSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: ['frontend', 'backend'],
      required: true,
    },

    url: {
      type: String,
      required: true,
      trim: true,
    },

    active: {
      type: Boolean,
      default: true,
    },

    monitoringEnabled: {
      type: Boolean,
      default: false,
    },

    checkInterval: {
      type: Number,
      required: true,
      default: 5,
    },

    checkIntervalUnit: {
      type: String,
      enum: ['minutes', 'hours'],
      default: 'minutes',
    },

    nextCheckAt: {
      type: Date,
      default: null,
      index: true,
    },

    lastStatus: {
      type: String,
      enum: ['up', 'down', 'unknown'],
      default: 'unknown',
    },

    lastCheckedAt: {
      type: Date,
      default: null,
    },

    lastResponseTime: {
      type: Number,
      default: null,
    },

    /**
     * Last status for which an alert was emitted (up/down).
     * Used so DOWN→DOWN does not re-alert and DOWN→UP sends one recovery.
     * null means no alert has been sent yet.
     */
    lastAlertStatus: {
      type: String,
      enum: ['up', 'down'],
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

websiteSchema.index({ monitoringEnabled: 1, nextCheckAt: 1 });

const Website = mongoose.model('Website', websiteSchema);

export default Website;
