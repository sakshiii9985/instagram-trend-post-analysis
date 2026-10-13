export interface StoredPost {
  postKey: string;
  postId: string | null;
  postUrl: string | null;
  username: string;
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

export interface StoredComment {
  postId: string;
  postUrl?: string | null;
  text?: string | null;
  sentiment?: string | null;
}

function average(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function engagement(post: StoredPost): number | null {
  if (post.likes === null && post.commentsCount === null) return null;
  return (post.likes ?? 0) + 2 * (post.commentsCount ?? 0);
}

function normalizedMediaType(value: string | null): string {
  if (!value) return 'Unknown';
  const lower = value.toLowerCase();
  if (lower.includes('reel')) return 'Reel';
  if (lower.includes('carousel')) return 'Carousel';
  if (lower.includes('video')) return 'Video';
  if (lower.includes('image') || lower.includes('photo')) return 'Image';
  return value;
}

export function getContentAnalysis(posts: StoredPost[]) {
  const groups = new Map<string, StoredPost[]>();
  for (const post of posts) {
    const mediaType = normalizedMediaType(post.mediaType);
    groups.set(mediaType, [...(groups.get(mediaType) ?? []), post]);
  }

  const mediaPerformance = [...groups.entries()].map(([mediaType, items]) => ({
    mediaType,
    count: items.length,
    averageLikes: average(items.flatMap((post) => post.likes === null ? [] : [post.likes])),
    averageComments: average(items.flatMap((post) => post.commentsCount === null ? [] : [post.commentsCount])),
    averageViews: average(items.flatMap((post) => post.views === null ? [] : [post.views])),
  }));

  const withImage = posts.filter((post) => post.imageUrls.length > 0);
  return {
    postCount: posts.length,
    mediaPerformance,
    imageAvailability: {
      postsWithImageUrls: withImage.length,
      postsWithoutImageUrls: posts.length - withImage.length,
      imageClassificationConfigured: false,
      message: 'Image category classification is not configured. No categories have been inferred.',
    },
  };
}

export function getSentimentAnalysis(comments: StoredComment[], posts: StoredPost[]) {
  const sentimentCounts = { Positive: 0, Neutral: 0, Negative: 0 };
  for (const comment of comments) {
    const sentiment = comment.sentiment?.toLowerCase();
    if (sentiment === 'positive' || sentiment === 'neutral' || sentiment === 'negative') {
      const key = sentiment[0].toUpperCase() + sentiment.slice(1) as keyof typeof sentimentCounts;
      sentimentCounts[key] += 1;
    }
  }

  const analyzedCount = Object.values(sentimentCounts).reduce((sum, count) => sum + count, 0);
  const postsById = new Map<string, StoredPost>();
  for (const post of posts) {
    if (post.postId) postsById.set(post.postId, post);
    postsById.set(post.postKey, post);
    if (post.postUrl) postsById.set(post.postUrl, post);
  }
  const sentimentEngagement = (['Positive', 'Neutral', 'Negative'] as const).map((sentiment) => {
    const linkedPosts = new Map<string, StoredPost>();
    comments
      .filter((comment) => comment.sentiment?.toLowerCase() === sentiment.toLowerCase())
      .forEach((comment) => {
        const post = postsById.get(comment.postId) ?? (comment.postUrl ? postsById.get(comment.postUrl) : undefined);
        if (post) linkedPosts.set(post.postId ?? post.postKey, post);
      });
    const sentimentPosts = [...linkedPosts.values()];
    return {
      sentiment,
      comments: sentimentCounts[sentiment],
      linkedPostCount: sentimentPosts.length,
      averagePostLikes: average(sentimentPosts.flatMap((post) => post.likes === null ? [] : [post.likes])),
      averagePostComments: average(sentimentPosts.flatMap((post) => post.commentsCount === null ? [] : [post.commentsCount])),
      averagePostEngagement: average(sentimentPosts.flatMap((post) => {
        const score = engagement(post);
        return score === null ? [] : [score];
      })),
    };
  });

  return {
    configured: analyzedCount > 0,
    totalStoredComments: comments.length,
    analyzedComments: analyzedCount,
    counts: sentimentCounts,
    percentages: analyzedCount
      ? Object.fromEntries(Object.entries(sentimentCounts).map(([label, count]) => [label, count / analyzedCount * 100]))
      : null,
    sentimentEngagement,
    message: analyzedCount
      ? null
      : comments.length === 0
        ? 'No Instagram comments are stored for this profile. Bright Data comment fetching is paused because credits are exhausted.'
        : 'Comments are stored, but none have sentiment labels. Bright Data comment fetching is paused because credits are exhausted.',
  };
}

export function getFuzzyClassification(posts: StoredPost[]) {
  const eligible = posts
    .map((post) => ({ post, score: engagement(post) }))
    .filter((item): item is { post: StoredPost; score: number } => item.score !== null);

  if (!eligible.length) {
    return {
      configured: false,
      postCount: posts.length,
      classifiedCount: 0,
      thresholds: null,
      membershipFunctions: null,
      distribution: { Low: 0, Medium: 0, High: 0 },
      classifications: [],
      message: 'Not enough saved likes/comments data to classify posts.',
    };
  }

  const scores = eligible.map((item) => item.score).sort((a, b) => a - b);
  const minimum = scores[0];
  const maximum = scores[scores.length - 1];
  const distribution = { Low: 0, Medium: 0, High: 0 };
  const classifications = eligible.map(({ post, score }) => {
    const normalized = maximum === minimum ? 0.5 : (score - minimum) / (maximum - minimum);
    const memberships = {
      Low: Math.max(0, Math.min(1, (0.5 - normalized) / 0.3)),
      Medium: Math.max(0, 1 - Math.abs(normalized - 0.5) / 0.3),
      High: Math.max(0, Math.min(1, (normalized - 0.5) / 0.3)),
    };
    const label = (Object.entries(memberships).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Medium') as keyof typeof distribution;
    distribution[label] += 1;
    return {
      postKey: post.postKey,
      postUrl: post.postUrl,
      thumbnailUrl: post.imageUrls[0] ?? post.videoUrl,
      caption: post.caption,
      datePosted: post.datePosted,
      mediaType: post.mediaType,
      engagementScore: score,
      normalizedScore: normalized,
      memberships,
      classification: label,
    };
  });

  return {
    configured: true,
    postCount: posts.length,
    classifiedCount: classifications.length,
    thresholds: { minimum, maximum, membershipDomain: '0 to 1, normalized to this saved profile dataset' },
    membershipFunctions: {
      low: 'left shoulder: full at 0, decreases linearly to 0 at 0.5',
      medium: 'triangle: 0 at 0.2 and 0.8, peak at 0.5',
      high: 'right shoulder: 0 at 0.5, increases linearly to full at 1',
    },
    distribution,
    classifications,
    message: null,
  };
}

export function getRecommendations(posts: StoredPost[]) {
  if (!posts.length) return { recommendations: [], message: 'No saved posts are available for recommendations.' };

  const recommendations: string[] = [];
  const mediaGroups = new Map<string, StoredPost[]>();
  const hours = new Map<number, number[]>();
  const hashtags = new Map<string, StoredPost[]>();

  for (const post of posts) {
    const media = normalizedMediaType(post.mediaType);
    mediaGroups.set(media, [...(mediaGroups.get(media) ?? []), post]);
    if (post.datePosted && engagement(post) !== null) {
      const date = new Date(post.datePosted);
      if (!Number.isNaN(date.getTime())) {
        const hour = date.getHours();
        hours.set(hour, [...(hours.get(hour) ?? []), engagement(post) as number]);
      }
    }
    for (const tagValue of post.hashtags) {
      const tag = tagValue.startsWith('#') ? tagValue : `#${tagValue}`;
      hashtags.set(tag, [...(hashtags.get(tag) ?? []), post]);
    }
  }

  const mostUsed = [...hashtags.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  if (mostUsed) recommendations.push(`${mostUsed[0]} was the most frequently used hashtag in this saved dataset (${mostUsed[1].length} posts).`);

  const mediaWithMetrics = [...mediaGroups.entries()].map(([mediaType, items]) => ({
    mediaType,
    count: items.length,
    averageEngagement: average(items.flatMap((post) => {
      const score = engagement(post);
      return score === null ? [] : [score];
    })),
  })).filter((item) => item.averageEngagement !== null);
  const leadingMedia = mediaWithMetrics.sort((a, b) => (b.averageEngagement ?? 0) - (a.averageEngagement ?? 0))[0];
  if (leadingMedia) {
    recommendations.push(`${leadingMedia.mediaType} posts had the highest average engagement score in this dataset (${Math.round(leadingMedia.averageEngagement as number)} across ${leadingMedia.count} posts). This is descriptive, not causal.`);
  }

  const leadingHour = [...hours.entries()]
    .map(([hour, scores]) => ({ hour, average: average(scores) }))
    .sort((a, b) => (b.average ?? 0) - (a.average ?? 0))[0];
  if (leadingHour) {
    recommendations.push(`Posts published around ${String(leadingHour.hour).padStart(2, '0')}:00 local time had the highest average engagement observed in this dataset. This does not predict future performance.`);
  }

  return { recommendations, message: recommendations.length ? null : 'Not enough available metadata for recommendations.' };
}

export function answerAnalyticsQuestion(question: string, posts: StoredPost[]): string {
  if (!posts.length) return "I don't have enough data to answer that.";
  const normalized = question.toLowerCase();
  const withScore = posts.map((post) => ({ post, score: engagement(post) }))
    .filter((item): item is { post: StoredPost; score: number } => item.score !== null);

  if (/low engagement|medium engagement|high engagement|engagement categor|fuzzy/.test(normalized)) {
    const category = normalized.match(/\b(low|medium|high)\b/)?.[1];
    const result = getFuzzyClassification(posts);
    const matches = result.classifications.filter((item) => !category || item.classification.toLowerCase() === category);
    if (!matches.length) return `No ${category ?? ''} engagement posts can be identified from the current saved data.`.replace(/\s+/g, ' ').trim();
    const summary = matches.slice(0, 5).map((item) =>
      `${item.classification} (${item.engagementScore.toLocaleString()} engagement)${item.postUrl ? `: ${item.postUrl}` : ''}`,
    );
    const relativeNote = ' These fuzzy categories are relative to this profile’s saved posts; they are not Random Forest or AdaBoost predictions.';
    return `${matches.length} ${category ? `${category} engagement` : ''} post${matches.length === 1 ? '' : 's'}: ${summary.join('; ')}.${relativeNote}`.replace(/\s+/g, ' ').trim();
  }
  if (/recommendation|what should|what to improve/.test(normalized)) {
    const result = getRecommendations(posts);
    return result.recommendations.length
      ? result.recommendations.join(' ')
      : result.message ?? "I don't have enough data to make a recommendation.";
  }
  if (/best|highest|top post|most engagement/.test(normalized)) {
    const best = withScore.sort((a, b) => b.score - a.score)[0];
    return best
      ? `The highest-scoring saved post has ${best.post.likes === null ? 'N/A' : best.post.likes.toLocaleString()} likes and ${best.post.commentsCount === null ? 'N/A' : best.post.commentsCount.toLocaleString()} comments (engagement score ${best.score.toLocaleString()}). ${best.post.postUrl ?? ''}`.trim()
      : "I don't have enough data to answer that.";
  }
  if (/average.*(engagement|likes|comments)|engagement average/.test(normalized)) {
    if (/average.*engagement|engagement average/.test(normalized)) {
      const averageScore = average(withScore.map((item) => item.score));
      return averageScore === null
        ? "I don't have enough data to answer that."
        : `Average engagement score (likes + 2 × comments) across saved posts is ${Math.round(averageScore).toLocaleString()}.`;
    }
    const likes = average(posts.flatMap((post) => post.likes === null ? [] : [post.likes]));
    const comments = average(posts.flatMap((post) => post.commentsCount === null ? [] : [post.commentsCount]));
    return `Across saved posts, average likes are ${likes === null ? 'N/A' : Math.round(likes).toLocaleString()}, and average comments are ${comments === null ? 'N/A' : Math.round(comments).toLocaleString()}.`;
  }
  if (/hashtag/.test(normalized)) {
    const counts = new Map<string, number>();
    for (const post of posts) for (const tag of post.hashtags) counts.set(tag.startsWith('#') ? tag : `#${tag}`, (counts.get(tag.startsWith('#') ? tag : `#${tag}`) ?? 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return top ? `${top[0]} was used most often (${top[1]} saved posts).` : "I don't have enough data to answer that.";
  }
  if (/media type|reel|carousel|image|video/.test(normalized)) {
    const byType = new Map<string, number>();
    for (const post of posts) {
      const type = normalizedMediaType(post.mediaType);
      byType.set(type, (byType.get(type) ?? 0) + (post.likes ?? 0));
    }
    const top = [...byType.entries()].sort((a, b) => b[1] - a[1])[0];
    return top ? `${top[0]} posts have the highest total likes in this saved dataset (${top[1].toLocaleString()}).` : "I don't have enough data to answer that.";
  }
  if (/publish|posting frequency|most frequently/.test(normalized)) {
    const days = new Map<string, number>();
    for (const post of posts) {
      if (!post.datePosted) continue;
      const date = new Date(post.datePosted);
      if (!Number.isNaN(date.getTime())) {
        const day = new Intl.DateTimeFormat('en', { weekday: 'long' }).format(date);
        days.set(day, (days.get(day) ?? 0) + 1);
      }
    }
    const top = [...days.entries()].sort((a, b) => b[1] - a[1])[0];
    return top ? `Posts were published most frequently on ${top[0]} (${top[1]} saved posts).` : "I don't have enough data to answer that.";
  }
  return "I don't have enough data to answer that.";
}
