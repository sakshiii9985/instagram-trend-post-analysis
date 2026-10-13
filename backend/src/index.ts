import cors from 'cors';
import dotenv from 'dotenv';
import express, { type ErrorRequestHandler } from 'express';
import mongoose from 'mongoose';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectToDatabase } from './config/db.js';
import { CommentModel } from './models/Comment.js';
import { InstagramPostModel } from './models/InstagramPost.js';
import { ProfileModel } from './models/Profile.js';
import { ReelModel } from './models/Reel.js';
import {
  answerAnalyticsQuestion,
  getContentAnalysis,
  getFuzzyClassification,
  getRecommendations,
  getSentimentAnalysis,
  type StoredComment,
  type StoredPost,
} from './services/dashboardAnalyticsService.js';
import {
  fetchInstagramPosts,
  fetchInstagramProfile,
  ProfileFetchError,
} from './services/brightDataService.js';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') });

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json({ limit: '32kb' }));

app.get('/api/health', (_req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  res.status(databaseConnected ? 200 : 503).json({
    ok: databaseConnected,
    database: databaseConnected ? 'connected' : 'disconnected',
  });
});

function normalizedUsername(value: string): string | null {
  const username = value.trim().replace(/^@/, '').toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(username) && !username.startsWith('.') && !username.endsWith('.')
    ? username
    : null;
}

function usernameFromInput(username: string, profileUrl: string): string | null {
  if (username) return normalizedUsername(username);
  try {
    const parsed = new URL(profileUrl);
    if (!['instagram.com', 'www.instagram.com'].includes(parsed.hostname.toLowerCase())) return null;
    return normalizedUsername(parsed.pathname.split('/').filter(Boolean)[0] ?? '');
  } catch {
    return null;
  }
}

function isDatabaseConnected(res: express.Response): boolean {
  if (mongoose.connection.readyState === 1) return true;
  res.status(503).json({
    success: false,
    message: 'MongoDB is not connected. Check the backend MongoDB connection.',
  });
  return false;
}

app.get('/api/instagram/profile/:username', async (req, res) => {
  const username = normalizedUsername(req.params.username);
  if (!username) {
    return res.status(400).json({ success: false, message: 'Enter a valid Instagram username.' });
  }
  if (!isDatabaseConnected(res)) return;

  try {
    const profile = await ProfileModel.findOne({ username }).lean();
    if (!profile) {
      return res.status(404).json({ success: false, message: 'No saved profile was found for this username.' });
    }
    return res.json({ success: true, profile });
  } catch (error) {
    console.error('MongoDB profile read failed', { name: error instanceof Error ? error.name : 'UnknownError' });
    return res.status(503).json({ success: false, message: 'Could not read the saved profile from MongoDB.' });
  }
});

app.get('/api/instagram/posts/:username', async (req, res) => {
  const username = normalizedUsername(req.params.username);
  if (!username) {
    return res.status(400).json({ success: false, message: 'Enter a valid Instagram username.' });
  }
  const limit = req.query.limit === undefined ? 10 : Number(req.query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return res.status(400).json({ success: false, message: 'The limit must be an integer between 1 and 100.' });
  }
  if (!isDatabaseConnected(res)) return;

  try {
    const posts = await InstagramPostModel.find({ username }).sort({ datePosted: -1, createdAt: -1 }).limit(limit).lean();
    return res.json({ success: true, count: posts.length, posts });
  } catch (error) {
    console.error('MongoDB posts read failed', { name: error instanceof Error ? error.name : 'UnknownError' });
    return res.status(503).json({ success: false, message: 'Could not read saved posts from MongoDB.' });
  }
});

app.get('/api/analytics/overview/:username', async (req, res) => {
  const username = normalizedUsername(req.params.username);
  if (!username) {
    return res.status(400).json({ success: false, message: 'Enter a valid Instagram username.' });
  }
  if (!isDatabaseConnected(res)) return;

  try {
    const [profile, [metrics]] = await Promise.all([
      ProfileModel.findOne({ username }).lean(),
      InstagramPostModel.aggregate([
        { $match: { username } },
        {
          $group: {
            _id: null,
            postCount: { $sum: 1 },
            likesCount: { $sum: { $cond: [{ $ne: ['$likes', null] }, 1, 0] } },
            commentsCountAvailable: { $sum: { $cond: [{ $ne: ['$commentsCount', null] }, 1, 0] } },
            viewsCount: { $sum: { $cond: [{ $ne: ['$views', null] }, 1, 0] } },
            totalLikes: { $sum: { $ifNull: ['$likes', 0] } },
            totalComments: { $sum: { $ifNull: ['$commentsCount', 0] } },
            totalViews: { $sum: { $ifNull: ['$views', 0] } },
            averageLikes: { $avg: '$likes' },
            averageComments: { $avg: '$commentsCount' },
          },
        },
      ]),
    ]);

    return res.json({
      success: true,
      profile,
      metrics: {
        postCount: metrics?.postCount ?? 0,
        totalLikes: metrics?.likesCount ? metrics.totalLikes : null,
        totalComments: metrics?.commentsCountAvailable ? metrics.totalComments : null,
        totalViews: metrics?.viewsCount ? metrics.totalViews : null,
        averageLikes: metrics?.averageLikes ?? null,
        averageComments: metrics?.averageComments ?? null,
      },
    });
  } catch (error) {
    console.error('MongoDB analytics overview read failed', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    return res.status(503).json({ success: false, message: 'Could not read analytics from MongoDB.' });
  }
});

app.get('/api/analytics/top-posts/:username', async (req, res) => {
  const username = normalizedUsername(req.params.username);
  if (!username) {
    return res.status(400).json({ success: false, message: 'Enter a valid Instagram username.' });
  }
  const limit = req.query.limit === undefined ? 5 : Number(req.query.limit);
  if (![5, 10, 20].includes(limit)) {
    return res.status(400).json({ success: false, message: 'The limit must be 5, 10, or 20.' });
  }
  const sort = typeof req.query.sort === 'string' ? req.query.sort : 'Engagement';
  if (!['Engagement', 'Likes', 'Comments', 'Views', 'Latest'].includes(sort)) {
    return res.status(400).json({ success: false, message: 'Choose a supported top-post sort option.' });
  }
  const media = typeof req.query.media === 'string' ? req.query.media : 'All';
  if (!['All', 'Posts', 'Reels'].includes(media)) {
    return res.status(400).json({ success: false, message: 'Choose All, Posts, or Reels as the media filter.' });
  }
  if (!isDatabaseConnected(res)) return;

  try {
    const match: Record<string, unknown> = { username };
    if (media === 'Reels') match.mediaType = /reel|video/i;
    if (media === 'Posts') match.mediaType = { $not: /reel|video/i };

    const pipeline: mongoose.PipelineStage[] = [{ $match: match }];
    if (sort === 'Engagement') {
      pipeline.push({
        $addFields: {
          engagementScore: {
            $add: [
              { $ifNull: ['$likes', 0] },
              { $multiply: [{ $ifNull: ['$commentsCount', 0] }, 2] },
            ],
          },
        },
      });
      pipeline.push({ $sort: { engagementScore: -1, datePosted: -1 } });
    } else if (sort === 'Latest') {
      pipeline.push({ $sort: { datePosted: -1, createdAt: -1 } });
    } else {
      const metricField = sort === 'Likes' ? 'likes' : sort === 'Comments' ? 'commentsCount' : 'views';
      pipeline.push({ $addFields: { sortValue: { $ifNull: [`$${metricField}`, -1] } } });
      pipeline.push({ $sort: { sortValue: -1, datePosted: -1 } });
    }
    pipeline.push({ $limit: limit });

    const posts = await InstagramPostModel.aggregate(pipeline);
    return res.json({ success: true, count: posts.length, posts });
  } catch (error) {
    console.error('MongoDB top posts read failed', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    return res.status(503).json({ success: false, message: 'Could not read top posts from MongoDB.' });
  }
});

app.get('/api/analytics/content/:username', async (req, res) => {
  const username = normalizedUsername(req.params.username);
  if (!username) return res.status(400).json({ success: false, message: 'Enter a valid Instagram username.' });
  if (!isDatabaseConnected(res)) return;
  try {
    const posts = await InstagramPostModel.find({ username }).lean<StoredPost[]>();
    return res.json({ success: true, ...getContentAnalysis(posts) });
  } catch (error) {
    console.error('MongoDB content analysis read failed', { name: error instanceof Error ? error.name : 'UnknownError' });
    return res.status(503).json({ success: false, message: 'Could not read content analysis data from MongoDB.' });
  }
});

app.get('/api/analytics/sentiment/:username', async (req, res) => {
  const username = normalizedUsername(req.params.username);
  if (!username) return res.status(400).json({ success: false, message: 'Enter a valid Instagram username.' });
  if (!isDatabaseConnected(res)) return;
  try {
    const posts = await InstagramPostModel.find({ username }).lean<StoredPost[]>();
    const postIds = posts.flatMap((post) => [post.postId, post.postKey, post.postUrl].filter((value): value is string => Boolean(value)));
    const comments: StoredComment[] = posts.length
      ? await CommentModel.find({ $or: [{ username }, { postId: { $in: postIds } }] })
        .select({ postId: 1, postUrl: 1, text: 1, sentiment: 1, _id: 0 }).lean<StoredComment[]>()
      : [];
    return res.json({ success: true, ...getSentimentAnalysis(comments, posts) });
  } catch (error) {
    console.error('MongoDB sentiment read failed', { name: error instanceof Error ? error.name : 'UnknownError' });
    return res.status(503).json({ success: false, message: 'Could not read stored sentiment data from MongoDB.' });
  }
});

app.post('/api/instagram/sentiment/:username', async (req, res) => {
  const username = normalizedUsername(req.params.username);
  if (!username) return res.status(400).json({ success: false, message: 'Enter a valid Instagram username.' });
  return res.status(503).json({
    success: false,
    message: 'Comment fetching is paused because Bright Data credits are exhausted. Stored MongoDB sentiment remains available.',
  });
});

app.get('/api/analytics/fuzzy/:username', async (req, res) => {
  const username = normalizedUsername(req.params.username);
  if (!username) return res.status(400).json({ success: false, message: 'Enter a valid Instagram username.' });
  if (!isDatabaseConnected(res)) return;
  try {
    const posts = await InstagramPostModel.find({ username }).lean<StoredPost[]>();
    return res.json({ success: true, ...getFuzzyClassification(posts) });
  } catch (error) {
    console.error('MongoDB fuzzy analysis read failed', { name: error instanceof Error ? error.name : 'UnknownError' });
    return res.status(503).json({ success: false, message: 'Could not read fuzzy analysis data from MongoDB.' });
  }
});

app.get('/api/analytics/ml/:username', async (req, res) => {
  const username = normalizedUsername(req.params.username);
  if (!username) return res.status(400).json({ success: false, message: 'Enter a valid Instagram username.' });
  if (!isDatabaseConnected(res)) return;
  return res.json({
    success: true,
    username,
    status: 'training_required',
    trainedModels: [],
    metrics: null,
    predictions: [],
    message: 'Model training required. No trained Random Forest or AdaBoost model is configured.',
  });
});

app.post('/api/chatbot', async (req, res) => {
  const username = typeof req.body?.username === 'string' ? normalizedUsername(req.body.username) : null;
  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
  if (!username || !question || question.length > 1000) {
    return res.status(400).json({ success: false, message: 'Provide a valid username and a question of at most 1000 characters.' });
  }
  if (!isDatabaseConnected(res)) return;
  try {
    const posts = await InstagramPostModel.find({ username }).lean<StoredPost[]>();
    return res.json({ success: true, answer: answerAnalyticsQuestion(question, posts) });
  } catch (error) {
    console.error('MongoDB chatbot query failed', { name: error instanceof Error ? error.name : 'UnknownError' });
    return res.status(503).json({ success: false, message: 'Could not read saved data for the chatbot.' });
  }
});

app.get('/api/recommendations/:username', async (req, res) => {
  const username = normalizedUsername(req.params.username);
  if (!username) return res.status(400).json({ success: false, message: 'Enter a valid Instagram username.' });
  if (!isDatabaseConnected(res)) return;
  try {
    const posts = await InstagramPostModel.find({ username }).lean<StoredPost[]>();
    return res.json({ success: true, ...getRecommendations(posts) });
  } catch (error) {
    console.error('MongoDB recommendations read failed', { name: error instanceof Error ? error.name : 'UnknownError' });
    return res.status(503).json({ success: false, message: 'Could not generate recommendations from MongoDB data.' });
  }
});

app.get('/api/settings/status', (_req, res) => {
  res.json({
    success: true,
    services: {
      mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      brightData: process.env.BRIGHTDATA_API_TOKEN
        && process.env.BRIGHTDATA_PROFILE_DATASET_ID
        && process.env.BRIGHTDATA_POSTS_DATASET_ID
        ? 'configured'
        : 'not configured',
      ml: 'not configured',
    },
  });
});

app.get('/api/instagram/reels/:username', async (req, res) => {
  const username = normalizedUsername(req.params.username);
  if (!username) {
    return res.status(400).json({ success: false, message: 'Enter a valid Instagram username.' });
  }
  if (!isDatabaseConnected(res)) return;

  try {
    const reels = await ReelModel.find({ username }).sort({ postedAt: -1, createdAt: -1 }).lean();
    return res.json({ success: true, count: reels.length, reels });
  } catch (error) {
    console.error('MongoDB reels read failed', { name: error instanceof Error ? error.name : 'UnknownError' });
    return res.status(503).json({ success: false, message: 'Could not read saved reels from MongoDB.' });
  }
});

app.get('/api/instagram/comments/:postId', async (req, res) => {
  const postId = req.params.postId.trim();
  if (!postId || postId.length > 200) {
    return res.status(400).json({ success: false, message: 'Enter a valid Instagram post ID.' });
  }
  if (!isDatabaseConnected(res)) return;

  try {
    const comments = await CommentModel.find({ postId }).sort({ postedAt: -1, createdAt: -1 }).lean();
    return res.json({ success: true, count: comments.length, comments });
  } catch (error) {
    console.error('MongoDB comments read failed', { name: error instanceof Error ? error.name : 'UnknownError' });
    return res.status(503).json({ success: false, message: 'Could not read saved comments from MongoDB.' });
  }
});

app.post('/api/instagram/profile', async (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const profileUrl = typeof req.body?.profileUrl === 'string' ? req.body.profileUrl.trim() : '';
  const usernameOrUrl = username || profileUrl;

  if (!usernameOrUrl) {
    return res.status(400).json({
      success: false,
      message: 'Provide either a username or a profileUrl.',
    });
  }

  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'MongoDB is not connected. Check the backend MongoDB connection.',
      });
    }

    const profile = await fetchInstagramProfile(usernameOrUrl);
    const storedProfile = await ProfileModel.findOneAndUpdate(
      { username: profile.username },
      { $set: profile },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean();

    console.info(`Saved Instagram profile @${profile.username} to MongoDB`);
    return res.json({ success: true, profile: storedProfile });
  } catch (error) {
    if (error instanceof ProfileFetchError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }

    if (error instanceof mongoose.Error || (error instanceof Error && error.name.includes('Mongo'))) {
      console.error('MongoDB profile save failed', { name: error.name });
      return res.status(503).json({
        success: false,
        message: 'The profile could not be saved to MongoDB. Check the database connection and profile collection.',
      });
    }

    console.error('Instagram profile request failed', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred while fetching the Instagram profile.',
    });
  }
});

app.post('/api/instagram/posts', async (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const profileUrl = typeof req.body?.profileUrl === 'string' ? req.body.profileUrl.trim() : '';
  const usernameOrUrl = username || profileUrl;

  if (!usernameOrUrl) {
    return res.status(400).json({
      success: false,
      message: 'Provide either a username or a profileUrl.',
    });
  }

  const requestedLimit = req.body?.limit === undefined ? 10 : Number(req.body.limit);
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1) {
    return res.status(400).json({
      success: false,
      message: 'The limit must be a positive integer (maximum 10).',
    });
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      message: 'MongoDB is not connected. Check the backend MongoDB connection.',
    });
  }

  try {
    const posts = await fetchInstagramPosts(usernameOrUrl, requestedLimit);
    if (posts.length) {
      await InstagramPostModel.bulkWrite(
        posts.map((post) => ({
          updateOne: {
            filter: { postKey: post.postKey },
            update: { $set: post },
            upsert: true,
          },
        })),
        { ordered: false },
      );
    }

    const savedUsername = posts[0]?.username ?? usernameFromInput(username, profileUrl);
    const storedPosts = savedUsername
      ? await InstagramPostModel.find({ username: savedUsername })
        .sort({ datePosted: -1, createdAt: -1 })
        .limit(requestedLimit)
        .lean()
      : [];

    console.info(`Saved ${posts.length} Instagram posts for @${posts[0]?.username ?? usernameOrUrl} to MongoDB`);
    return res.json({ success: true, count: storedPosts.length, posts: storedPosts });
  } catch (error) {
    if (error instanceof ProfileFetchError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }

    if (error instanceof mongoose.Error || (error instanceof Error && error.name.includes('Mongo'))) {
      console.error('MongoDB posts save failed', { name: error.name });
      return res.status(503).json({
        success: false,
        message: 'Posts were fetched but could not be saved to MongoDB. Check the database connection and post collection.',
      });
    }

    console.error('Instagram posts request failed', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred while fetching Instagram posts.',
    });
  }
});

app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'API route not found.' });
});

const expressErrorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({ success: false, message: 'Request body must be valid JSON.' });
    return;
  }
  console.error('Unhandled Express error', { name: error instanceof Error ? error.name : 'UnknownError' });
  res.status(500).json({ success: false, message: 'Unexpected server error.' });
};
app.use(expressErrorHandler);

async function startServer(): Promise<void> {
  await connectToDatabase();
  app.listen(port, () => {
    console.log(`Instagram Trend and Post Analysis backend running on http://localhost:${port}`);
  });
}

startServer().catch((error: unknown) => {
  console.error('Backend startup failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
});
