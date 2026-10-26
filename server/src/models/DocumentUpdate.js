import mongoose from 'mongoose';

const DocumentUpdateSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
      index: true
    },
    update: {
      type: Buffer,
      required: true
    },
    sequenceNumber: {
      type: Number,
      default: 1
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true
  }
);

DocumentUpdateSchema.index({ documentId: 1, sequenceNumber: 1 });
DocumentUpdateSchema.index({ documentId: 1, createdAt: 1 });

export const DocumentUpdate = mongoose.model('DocumentUpdate', DocumentUpdateSchema);
