import mongoose from 'mongoose';

const DocumentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Document title is required'],
      trim: true,
      default: 'Untitled Document',
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    metadata: {
      wordCount: {
        type: Number,
        default: 0
      },
      characterCount: {
        type: Number,
        default: 0
      },
      isArchived: {
        type: Boolean,
        default: false,
        index: true
      }
    }
  },
  {
    timestamps: true
  }
);

DocumentSchema.index({ ownerId: 1, updatedAt: -1 });
DocumentSchema.index({ title: 'text' });

export const Document = mongoose.model('Document', DocumentSchema);
