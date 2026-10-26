import mongoose from 'mongoose';
import crypto from 'crypto';

const ShareLinkSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
      index: true
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    permission: {
      type: String,
      enum: ['viewer', 'editor'],
      default: 'viewer',
      required: true
    },
    expiresAt: {
      type: Date,
      default: null
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true
  }
);

ShareLinkSchema.statics.hashToken = function (token) {
  return crypto.createHash('sha256').update(token).digest('hex');
};

ShareLinkSchema.statics.generateRawToken = function () {
  return crypto.randomBytes(32).toString('hex');
};

export const ShareLink = mongoose.model('ShareLink', ShareLinkSchema);
