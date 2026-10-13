import mongoose, { Schema } from 'mongoose';

const commentFetchSchema = new Schema(
  {
    username: { type: String, required: true, index: true },
    postId: { type: String, required: true },
    postUrl: { type: String, required: true, unique: true },
    commentCount: { type: Number, required: true, default: 0 },
    analyzedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true, versionKey: false },
);

export const CommentFetchModel =
  mongoose.models.CommentFetch || mongoose.model('CommentFetch', commentFetchSchema);
