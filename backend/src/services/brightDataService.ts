import axios, { type AxiosResponse } from 'axios';
import { createHash } from 'node:crypto';

export interface InstagramPostData {
  postKey: string;
  postId: string | null;
  username: string;
  profileUrl: string;
  postUrl: string | null;
  caption: string | null;
  hashtags: string[];
  likes: number | null;
  commentsCount: number | null;
  views: number | null;
  datePosted: string | null;
  mediaType: string | null;
  imageUrls: string[];
  videoUrl: string | null;
}

export interface InstagramProfileData {
  username: string;
  profileUrl: string;
  userId: string | null;
  fullName: string | null;
  followers: number | null;
  following: number | null;
  postsCount: number | null;
  biography: string | null;
  verified: boolean | null;
  externalUrl: string | null;
  profileImage: string | null;
}

export interface InstagramCommentData {
  commentId: string;
  username: string;
  postId: string;
  postUrl: string;
  text: string;
  likes: number | null;
  postedAt: Date | null;
}

export class ProfileFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'ProfileFetchError';
  }
}

const BRIGHTDATA_API_BASE = 'https://api.brightdata.com/datasets/v3';
const REQUEST_TIMEOUT_MS = 30_000;
const SNAPSHOT_TIMEOUT_MS = 300_000;
const SNAPSHOT_POLL_INTERVAL_MS = 3_000;

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

function firstValue(source: JsonObject, keys: string[]): unknown {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function stringValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (value && typeof value === 'object') {
    const item = value as JsonObject;
    return stringValue(item.url ?? item.href ?? item.value);
  }
  return null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function booleanValue(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    const single = stringValue(value);
    return single ? [single] : [];
  }
  return value.map(stringValue).filter((item): item is string => item !== null);
}

function normalizeInstagramInput(input: string): { username: string; profileUrl: string } {
  const value = input.trim();
  if (!value) {
    throw new ProfileFetchError('Provide an Instagram username or profile URL.', 400);
  }

  let username: string;
  if (/^https?:\/\//i.test(value)) {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new ProfileFetchError('Enter a valid Instagram profile URL.', 400);
    }

    if (!['instagram.com', 'www.instagram.com'].includes(parsed.hostname.toLowerCase())) {
      throw new ProfileFetchError('The URL must be an Instagram profile URL.', 400);
    }

    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length !== 1) {
      throw new ProfileFetchError('Enter a URL for an Instagram profile, not a post or other page.', 400);
    }
    username = segments[0];
  } else {
    username = value.replace(/^@/, '');
    if (username.includes('/') || username.includes('?') || username.includes('#')) {
      throw new ProfileFetchError('Enter an Instagram username or a full profile URL.', 400);
    }
  }

  if (!/^[A-Za-z0-9._]{1,30}$/.test(username) || username.startsWith('.') || username.endsWith('.')) {
    throw new ProfileFetchError('Enter a valid Instagram username.', 400);
  }

  const normalizedUsername = username.toLowerCase();
  return {
    username: normalizedUsername,
    profileUrl: `https://www.instagram.com/${normalizedUsername}/`,
  };
}

function findProfileRows(payload: unknown): JsonObject[] {
  if (Array.isArray(payload)) {
    return payload.map(asObject).filter((item): item is JsonObject => item !== null);
  }

  const object = asObject(payload);
  if (!object) return [];

  for (const key of ['data', 'results', 'result', 'profiles', 'snapshot']) {
    const value = object[key];
    if (Array.isArray(value)) {
      return value.map(asObject).filter((item): item is JsonObject => item !== null);
    }
    const nested = asObject(value);
    if (nested) {
      const nestedRows = findProfileRows(nested);
      if (nestedRows.length) return nestedRows;
    }
  }

  return [object];
}

function profileUsername(row: JsonObject): string | null {
  return stringValue(firstValue(row, ['username', 'user_name', 'userName', 'account', 'handle']));
}

function normalizeProfile(payload: unknown, requested: { username: string; profileUrl: string }): InstagramProfileData {
  const rows = findProfileRows(payload);
  const matchingRow = rows.find((item) => profileUsername(item)?.toLowerCase() === requested.username);
  const row = matchingRow ?? (rows.length === 1 ? rows[0] : undefined);

  if (!row) {
    throw new ProfileFetchError('Bright Data returned no profile data for this username.', 404);
  }

  const resultError = stringValue(firstValue(row, ['error', 'error_message', 'errorMessage', 'error_type']));
  if (resultError) {
    throw new ProfileFetchError('Bright Data could not find a public profile for this username.', 404);
  }

  const returnedUsername = profileUsername(row);
  if (!returnedUsername) {
    throw new ProfileFetchError('Bright Data returned a result without an Instagram username.', 502);
  }
  if (returnedUsername.toLowerCase() !== requested.username) {
    throw new ProfileFetchError('Bright Data returned a different profile than the one requested.', 404);
  }
  const username = requested.username;

  return {
    username,
    profileUrl: stringValue(firstValue(row, ['profile_url', 'profileUrl', 'url', 'instagram_url']))
      ?? `https://www.instagram.com/${username}/`,
    userId: stringValue(firstValue(row, ['user_id', 'userId', 'id', 'pk'])),
    fullName: stringValue(firstValue(row, ['full_name', 'fullName', 'name'])),
    followers: numberValue(firstValue(row, ['followers', 'followers_count', 'follower_count', 'followersCount'])),
    following: numberValue(firstValue(row, ['following', 'following_count', 'followingCount'])),
    postsCount: numberValue(firstValue(row, ['posts_count', 'post_count', 'media_count', 'postsCount', 'postCount'])),
    biography: stringValue(firstValue(row, ['biography', 'bio', 'about'])),
    verified: booleanValue(firstValue(row, ['is_verified', 'verified', 'isVerified'])),
    externalUrl: stringValue(firstValue(row, ['external_url', 'externalUrl', 'website', 'external_links'])),
    profileImage: stringValue(firstValue(row, [
      'profile_image',
      'profile_image_link',
      'profile_image_url',
      'profile_pic_url',
      'profile_pic_url_hd',
      'profileImage',
      'profile_picture',
      'profile_pic',
      'avatar',
    ])),
  };
}

function getApiErrorStatus(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined;
}

function translateBrightDataError(error: unknown, resource: 'profile' | 'posts' | 'comments' = 'profile'): ProfileFetchError {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new ProfileFetchError(`Bright Data ${resource} request timed out. Please try again.`, 504);
    }

    const status = getApiErrorStatus(error);
    if (status === 400) return new ProfileFetchError(`Bright Data rejected the ${resource} request. Check the configured ${resource} dataset and its input format.`, 502);
    if (status === 401 || status === 403) return new ProfileFetchError('Bright Data authentication failed. Check the backend API token.', 502);
    if (status === 404) return new ProfileFetchError(`Bright Data could not find the ${resource} dataset or snapshot. Check the configured dataset ID.`, 502);
    if (status === 429) return new ProfileFetchError('Bright Data rate limit reached. Please try again later.', 503);
    return new ProfileFetchError(`Bright Data could not complete the ${resource} request.`, 502);
  }

  if (error instanceof ProfileFetchError) return error;
  return new ProfileFetchError('Unable to fetch this Instagram profile from Bright Data.', 502);
}

async function wait(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchSnapshot(
  snapshotId: string,
  token: string,
  startedAt: number,
): Promise<unknown> {
  let pollCount = 0;
  while (Date.now() - startedAt < SNAPSHOT_TIMEOUT_MS) {
    const progressResponse: AxiosResponse<unknown> = await axios.get(
      `${BRIGHTDATA_API_BASE}/progress/${encodeURIComponent(snapshotId)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: REQUEST_TIMEOUT_MS,
      },
    );
    const progress = asObject(progressResponse.data);
    const status = stringValue(progress?.status)?.toLowerCase();
    pollCount += 1;
    if (pollCount === 1 || pollCount % 10 === 0) {
      console.info(`Bright Data collection status: ${status ?? 'unknown'}`);
    }

    if (status === 'ready' || status === 'completed' || status === 'complete') {
      const snapshotResponse = await axios.get(
        `${BRIGHTDATA_API_BASE}/snapshot/${encodeURIComponent(snapshotId)}?format=json`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: REQUEST_TIMEOUT_MS,
        },
      );
      return snapshotResponse.data;
    }

    if (status === 'failed' || status === 'error' || status === 'cancelled') {
      throw new ProfileFetchError('Bright Data could not scrape this Instagram profile.', 502);
    }

    await wait(SNAPSHOT_POLL_INTERVAL_MS);
  }

  throw new ProfileFetchError('Bright Data collection timed out. Please try again.', 504);
}

function findCommentRows(payload: unknown): JsonObject[] {
  if (Array.isArray(payload)) {
    return payload.map(asObject).filter((item): item is JsonObject => item !== null);
  }

  const object = asObject(payload);
  if (!object) return [];

  for (const key of ['data', 'results', 'result', 'comments', 'snapshot']) {
    const value = object[key];
    if (Array.isArray(value)) {
      return value.map(asObject).filter((item): item is JsonObject => item !== null);
    }
    const nestedRows = findCommentRows(value);
    if (nestedRows.length) return nestedRows;
  }
  return [];
}

export async function fetchInstagramComments(
  postUrl: string,
  username: string,
  postId: string,
): Promise<InstagramCommentData[]> {
  const token = process.env.BRIGHTDATA_API_TOKEN;
  const datasetId = process.env.BRIGHTDATA_COMMENTS_DATASET_ID;
  if (!token || !datasetId) {
    throw new ProfileFetchError(
      'Bright Data comments are not configured. Set BRIGHTDATA_API_TOKEN and BRIGHTDATA_COMMENTS_DATASET_ID in backend/.env.',
      500,
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(postUrl);
  } catch {
    throw new ProfileFetchError('A valid saved Instagram post or reel URL is required to fetch comments.', 400);
  }
  if (
    !['instagram.com', 'www.instagram.com'].includes(parsedUrl.hostname.toLowerCase())
    || !/^\/(?:[^/]+\/)?(?:p|reel|tv)\/[^/]+\/?$/i.test(parsedUrl.pathname)
  ) {
    throw new ProfileFetchError('Comments can only be fetched from a saved Instagram post or reel URL.', 400);
  }

  console.info(`Bright Data comments collection started for one saved post by @${username}`);

  try {
    const scrapeResponse = await axios.post(
      `${BRIGHTDATA_API_BASE}/scrape`,
      { input: [{ url: postUrl }] },
      {
        params: { dataset_id: datasetId, include_errors: true },
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
    );

    const scrapeData = scrapeResponse.data;
    const scrapeObject = asObject(scrapeData);
    const snapshotId = stringValue(firstValue(scrapeObject ?? {}, ['snapshot_id', 'snapshotId']));
    const result = snapshotId ? await fetchSnapshot(snapshotId, token, Date.now()) : scrapeData;
    const rows = findCommentRows(result);
    const invalidRow = rows.find((row) => firstValue(row, ['error', 'error_message', 'errorMessage', 'error_type']));
    if (invalidRow) throw new ProfileFetchError('Bright Data could not fetch comments for the saved Instagram post.', 404);

    const comments = rows.flatMap((row): InstagramCommentData[] => {
      const text = stringValue(firstValue(row, ['comment', 'text', 'comment_text', 'content']));
      const providerId = stringValue(firstValue(row, ['comment_id', 'commentId', 'id']));
      if (!text || !providerId) return [];
      const postUrlFromRow = stringValue(firstValue(row, ['post_url', 'postUrl'])) ?? postUrl;
      const postIdFromRow = stringValue(firstValue(row, ['post_id', 'postId'])) ?? postId;
      const dateValue = stringValue(firstValue(row, ['comment_date', 'date', 'posted_at', 'timestamp']));
      const date = dateValue ? new Date(dateValue) : null;
      return [{
        commentId: providerId,
        username,
        postId: postIdFromRow,
        postUrl: postUrlFromRow,
        text,
        likes: numberValue(firstValue(row, ['likes_number', 'likes', 'like_count'])),
        postedAt: date && !Number.isNaN(date.getTime()) ? date : null,
      }];
    }).slice(0, 15);

    console.info(`Bright Data returned ${comments.length} comments for one saved post by @${username}`);
    return comments;
  } catch (error) {
    if (error instanceof ProfileFetchError) throw error;
    const translated = translateBrightDataError(error, 'comments');
    const status = getApiErrorStatus(error);
    const code = axios.isAxiosError(error) ? error.code : undefined;
    console.error('Bright Data comments request failed', { status, code, message: translated.message });
    throw translated;
  }
}

function findPostRows(payload: unknown): JsonObject[] {
  if (Array.isArray(payload)) {
    return payload.map(asObject).filter((item): item is JsonObject => item !== null);
  }

  const object = asObject(payload);
  if (!object) return [];

  for (const key of ['data', 'results', 'result', 'posts', 'snapshot']) {
    const value = object[key];
    if (Array.isArray(value)) {
      return value.map(asObject).filter((item): item is JsonObject => item !== null);
    }
    const nested = asObject(value);
    if (nested) {
      const rows = findPostRows(nested);
      if (rows.length) return rows;
    }
  }

  return [];
}

function normalizePost(row: JsonObject, username: string, profileUrl: string): InstagramPostData {
  const postUrl = stringValue(firstValue(row, ['post_url', 'postUrl', 'url', 'link', 'permalink']));
  const postId = stringValue(firstValue(row, ['post_id', 'postId', 'id', 'shortcode', 'short_code', 'code']));
  const caption = stringValue(firstValue(row, ['description', 'caption', 'text']));
  const hashtags = stringArray(firstValue(row, ['hashtags', 'hash_tags']));
  const likes = numberValue(firstValue(row, ['likes', 'likes_count', 'like_count', 'num_likes']));
  const commentsCount = numberValue(firstValue(row, ['comments', 'comments_count', 'comment_count', 'num_comments']));
  const views = numberValue(firstValue(row, ['views', 'view_count', 'video_view_count', 'plays']));
  const datePosted = stringValue(firstValue(row, ['date_posted', 'posted_at', 'timestamp', 'taken_at', 'date']));
  const mediaType = stringValue(firstValue(row, ['media_type', 'content_type', 'type']));
  const imageUrls = [
    ...stringArray(firstValue(row, ['photos', 'images', 'image_urls', 'display_url', 'thumbnail_url', 'thumbnail'])),
  ];
  const videoValues = stringArray(firstValue(row, ['video_url', 'videoUrl', 'videos', 'video']));
  const videoUrl = videoValues[0] ?? null;

  const urlId = postUrl?.match(/\/(?:p|reel|tv)\/([^/?#]+)/i)?.[1] ?? null;
  const stablePostId = postId ?? urlId;
  const stableMaterial = stablePostId
    ? `${username}:${stablePostId}`
    : `${username}:${postUrl ?? JSON.stringify([caption, datePosted, mediaType, imageUrls])}`;

  return {
    postKey: createHash('sha256').update(stableMaterial).digest('hex'),
    postId: stablePostId,
    username,
    profileUrl,
    postUrl,
    caption,
    hashtags,
    likes,
    commentsCount,
    views,
    datePosted,
    mediaType,
    imageUrls,
    videoUrl,
  };
}

export async function fetchInstagramPosts(
  profileUrl: string,
  limit = 10,
): Promise<InstagramPostData[]> {
  const requested = normalizeInstagramInput(profileUrl);
  const normalizedLimit = Math.max(1, Math.min(10, Math.floor(limit)));
  const token = process.env.BRIGHTDATA_API_TOKEN;
  const datasetId = process.env.BRIGHTDATA_POSTS_DATASET_ID;

  if (!token || !datasetId) {
    throw new ProfileFetchError(
      'Bright Data posts are not configured. Set BRIGHTDATA_API_TOKEN and BRIGHTDATA_POSTS_DATASET_ID in backend/.env.',
      500,
    );
  }

  console.info(`Bright Data posts collection started for @${requested.username}`);

  try {
    const triggerResponse = await axios.post(
      `${BRIGHTDATA_API_BASE}/trigger`,
      {
        input: [{ url: requested.profileUrl }],
        limit_per_input: normalizedLimit,
      },
      {
        params: {
          dataset_id: datasetId,
          include_errors: true,
          type: 'discover_new',
          discover_by: 'url',
        },
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
    );

    const triggerData = triggerResponse.data;
    const triggerObject = asObject(triggerData);
    const snapshotId = stringValue(firstValue(triggerObject ?? {}, ['snapshot_id', 'snapshotId']));
    const result = snapshotId
      ? await fetchSnapshot(snapshotId, token, Date.now())
      : triggerData;
    const rows = findPostRows(result);
    const errorRow = rows.find((row) => firstValue(row, ['error', 'error_message', 'errorMessage', 'error_type']));

    if (errorRow) {
      throw new ProfileFetchError('Bright Data could not fetch posts for this Instagram profile.', 404);
    }

    const posts = rows
      .map((row) => normalizePost(row, requested.username, requested.profileUrl))
      .slice(0, normalizedLimit);

    console.info(`Bright Data returned ${posts.length} posts for @${requested.username}`);
    return posts;
  } catch (error) {
    if (error instanceof ProfileFetchError) {
      console.warn(`Bright Data posts collection failed for @${requested.username}: ${error.message}`);
      throw error;
    }

    const translated = translateBrightDataError(error, 'posts');
    const status = getApiErrorStatus(error);
    const code = axios.isAxiosError(error) ? error.code : undefined;
    console.error('Bright Data posts request failed', { status, code, message: translated.message });
    throw translated;
  }
}

export async function fetchInstagramProfile(usernameOrUrl: string): Promise<InstagramProfileData> {
  const requested = normalizeInstagramInput(usernameOrUrl);
  const token = process.env.BRIGHTDATA_API_TOKEN;
  const datasetId = process.env.BRIGHTDATA_PROFILE_DATASET_ID;

  if (!token || !datasetId) {
    throw new ProfileFetchError(
      'Bright Data is not configured. Set BRIGHTDATA_API_TOKEN and BRIGHTDATA_PROFILE_DATASET_ID in backend/.env.',
      500,
    );
  }

  console.info(`Bright Data profile collection started for @${requested.username}`);

  try {
    const triggerResponse = await axios.post(
      `${BRIGHTDATA_API_BASE}/trigger`,
      [{ user_name: requested.username }],
      {
        params: {
          dataset_id: datasetId,
          include_errors: true,
          type: 'discover_new',
          discover_by: 'user_name',
        },
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
    );

    const triggerData = triggerResponse.data;
    const triggerObject = asObject(triggerData);
    const snapshotId = stringValue(firstValue(triggerObject ?? {}, ['snapshot_id', 'snapshotId']));

    const result = snapshotId
      ? await fetchSnapshot(snapshotId, token, Date.now())
      : triggerData;

    const profile = normalizeProfile(result, requested);
    console.info(`Bright Data profile collection completed for @${profile.username}`);
    return {
      ...profile,
      profileUrl: profile.profileUrl || requested.profileUrl,
    };
  } catch (error) {
    if (error instanceof ProfileFetchError) {
      console.warn(`Bright Data profile collection failed for @${requested.username}: ${error.message}`);
      throw error;
    }

    const translated = translateBrightDataError(error);
    const status = getApiErrorStatus(error);
    const code = axios.isAxiosError(error) ? error.code : undefined;
    console.error('Bright Data profile request failed', { status, code, message: translated.message });
    throw translated;
  }
}
