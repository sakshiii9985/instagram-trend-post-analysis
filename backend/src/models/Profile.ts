import mongoose, { Schema } from 'mongoose';

const profileSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, index: true },
    profileUrl: { type: String, required: true },
    userId: { type: String, default: null },
    fullName: { type: String, default: null },
    followers: { type: Number, default: null },
    following: { type: Number, default: null },
    postsCount: { type: Number, default: null },
    biography: { type: String, default: null },
    verified: { type: Boolean, default: null },
    externalUrl: { type: String, default: null },
    profileImage: { type: String, default: null },
  },
  { timestamps: true, versionKey: false },
);

export const ProfileModel = mongoose.models.Profile || mongoose.model('Profile', profileSchema);
