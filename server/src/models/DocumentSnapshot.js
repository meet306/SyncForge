import mongoose from 'mongoose';

const DocumentSnapshotSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
      index: true
    },
    snapshot: {
      type: Buffer,
      required: true
    },
    version: {
      type: Number,
      default: 1
    },
    plainTextPreview: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

DocumentSnapshotSchema.index({ documentId: 1, version: -1 });

export const DocumentSnapshot = mongoose.model('DocumentSnapshot', DocumentSnapshotSchema);
