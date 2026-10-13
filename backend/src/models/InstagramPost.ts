import mongoose, { Schema } from 'mongoose';

const instagramPostSchema = new Schema(
  {
    postKey: { type: String, required: true, unique: true, index: true },
    postId: { type: String, default: null },
    username: { type: String, required: true, index: true },
    profileUrl: { type: String, required: true },
    postUrl: { type: String, default: null },
    caption: { type: String, default: null },
    hashtags: { type: [String], default: [] },
    likes: { type: Number, default: null },
    commentsCount: { type: Number, default: null },
    views: { type: Number, default: null },
    datePosted: { type: String, default: null },
    mediaType: { type: String, default: null },
    imageUrls: { type: [String], default: [] },
    videoUrl: { type: String, default: null },
  },
  { timestamps: true, versionKey: false },
);

export const InstagramPostModel =
  mongoose.models.InstagramPost || mongoose.model('InstagramPost', instagramPostSchema);
