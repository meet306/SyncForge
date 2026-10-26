import mongoose from 'mongoose';

const DocumentMemberSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    role: {
      type: String,
      enum: ['owner', 'editor', 'viewer'],
      default: 'viewer',
      required: true
    }
  },
  {
    timestamps: true
  }
);

DocumentMemberSchema.index({ documentId: 1, userId: 1 }, { unique: true });
DocumentMemberSchema.index({ userId: 1, updatedAt: -1 });

export const DocumentMember = mongoose.model('DocumentMember', DocumentMemberSchema);
