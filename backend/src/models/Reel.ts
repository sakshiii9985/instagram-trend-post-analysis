import mongoose, { Schema } from 'mongoose';

const reelSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    username: String,
    url: String,
    caption: String,
    hashtags: [String],
    likes: Number,
    comments: Number,
    views: Number,
    mediaType: String,
    mediaUrl: String,
    postedAt: Date,
  },
  { timestamps: true },
);

export const ReelModel = mongoose.models.Reel || mongoose.model('Reel', reelSchema);
