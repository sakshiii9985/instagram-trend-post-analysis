export type MediaType = 'image' | 'video' | 'reel';

export interface InstagramMedia {
  id: string;
  username: string;
  url: string;
  caption: string;
  hashtags: string[];
  likes: number;
  comments: number;
  views: number;
  mediaType: MediaType;
  mediaUrl: string;
  postedAt: string;
}

export interface InstagramProfile {
  username: string;
  profileUrl: string;
  fullName: string;
  profileImage: string;
  followers: number;
  following: number;
  postCount: number;
  verified: boolean;
  posts: InstagramMedia[];
  reels: InstagramMedia[];
}

export interface AnalysisResult {
  totalLikes: number;
  totalComments: number;
  averageLikes: number;
  averageComments: number;
  averageViews: number;
  engagementScore: number;
  topPosts: Array<{ id: string; label: string; likes: number; comments: number; views: number; url: string; }>; 
  hashtagStats: Record<string, number>;
  postingTimeStats: Record<string, number>;
  sentimentStats: Record<string, number>;
  imageCategories: { label: string; value: number; color: string }[];
  fuzzyResults: Record<string, number>;
  mlResults: Record<string, number | string>;
  bayesianResults: Record<string, number | string>;
  engagementOverTime: Array<{ day: string; engagement: number }>; 
  engagementByDay: Array<{ day: string; value: number }>; 
  engagementByHour: Array<{ hour: string; value: number }>;
  postVsReel: { posts: number; reels: number };
  engagementDistribution: { Low: number; Medium: number; High: number };
}
