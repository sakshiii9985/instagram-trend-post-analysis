import mongoose, { Schema } from 'mongoose';

const analysisSchema = new Schema(
  {
    totalLikes: Number,
    totalComments: Number,
    averageLikes: Number,
    averageComments: Number,
    averageViews: Number,
    engagementScore: Number,
    topPosts: [{ id: String, label: String, likes: Number, comments: Number, views: Number, url: String }],
    hashtagStats: Schema.Types.Mixed,
    postingTimeStats: Schema.Types.Mixed,
    sentimentStats: Schema.Types.Mixed,
    imageCategories: [{ label: String, value: Number, color: String }],
    fuzzyResults: Schema.Types.Mixed,
    mlResults: Schema.Types.Mixed,
    bayesianResults: Schema.Types.Mixed,
  },
  { timestamps: true },
);

export const AnalysisModel = mongoose.models.Analysis || mongoose.model('Analysis', analysisSchema);
