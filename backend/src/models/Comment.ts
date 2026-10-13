import mongoose, { Schema } from 'mongoose';

const commentSchema = new Schema(
  {
    commentId: { type: String, default: null },
    username: { type: String, index: true },
    postId: { type: String, required: true },
    postUrl: { type: String, default: null },
    text: String,
    likes: Number,
    postedAt: Date,
    sentiment: String,
    sentimentScore: Number,
    sentimentMethod: String,
  },
  { timestamps: true },
);

commentSchema.index({ commentId: 1 }, { unique: true, sparse: true });
commentSchema.index({ username: 1, postId: 1 });

export const CommentModel = mongoose.models.Comment || mongoose.model('Comment', commentSchema);
