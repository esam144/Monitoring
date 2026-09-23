import mongoose from 'mongoose';

const monitorCheckSchema = new mongoose.Schema(
  {
    website: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Website',
      required: true,
      index: true,
    },
    /** Denormalized for readable Compass / logs — keep ObjectId for relations */
    websiteName: {
      type: String,
      default: null,
      trim: true,
    },
    websiteUrl: {
      type: String,
      default: null,
      trim: true,
    },
    status: {
      type: String,
      enum: ['up', 'down'],
      required: true,
    },
    responseTime: {
      type: Number,
      default: null,
    },
    statusCode: {
      type: Number,
      default: null,
    },
    checkedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

monitorCheckSchema.index({ website: 1, checkedAt: -1 });

const MonitorCheck = mongoose.model('MonitorCheck', monitorCheckSchema);

export default MonitorCheck;
