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
      default: 10,
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
     * Tracks the current downtime incident; null means no alert yet.
     */
    lastAlertStatus: {
      type: String,
      enum: ['up', 'down'],
      default: null,
    },

    /**
     * Per-website Slack notification preferences.
     * Global/default settings can be layered on later without a new collection.
     */
    slackSettings: {
      enabled: {
        type: Boolean,
        default: true,
      },
      repeatInterval: {
        type: Number,
        default: 6,
      },
      repeatUnit: {
        type: String,
        enum: ['minutes', 'hours', 'days'],
        default: 'hours',
      },
      recoveryNotification: {
        type: Boolean,
        default: true,
      },
    },

    /** Set only after a Slack DOWN alert is successfully sent/queued. */
    lastSlackNotificationAt: {
      type: Date,
      default: null,
    },

    /** Start of the current DOWN incident (cleared on recovery). */
    downtimeStartedAt: {
      type: Date,
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
