import axios from 'axios';
import { motion } from 'framer-motion';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

type InstagramProfile = {
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
  updatedAt?: string;
};

type ProfileResponse = {
  success: boolean;
  profile: InstagramProfile;
  message?: string;
};

type InstagramPost = {
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
};

type PostsResponse = {
  success: boolean;
  count: number;
  posts: InstagramPost[];
  message?: string;
};

type OverviewResponse = {
  success: boolean;
  profile: InstagramProfile | null;
  metrics: {
    postCount: number;
    totalLikes: number | null;
    totalComments: number | null;
    totalViews: number | null;
    averageLikes: number | null;
    averageComments: number | null;
  };
  message?: string;
};

type DashboardView =
  | 'Overview'
  | 'Top Posts'
  | 'Hashtags'
  | 'Content Analysis'
  | 'Sentiment Analysis'
  | 'Analysis'
  | 'ML Prediction'
  | 'Recommendations'
  | 'Chatbot'
  | 'Settings'
  | 'Architecture';
type TopPostsFilter = 'All' | 'Posts' | 'Reels';
type TopPostsSort = 'Engagement' | 'Likes' | 'Comments' | 'Views' | 'Latest';
type ContentResponse = {
  postCount: number;
  mediaPerformance: Array<{
    mediaType: string;
    count: number;
    averageLikes: number | null;
    averageComments: number | null;
    averageViews: number | null;
  }>;
  imageAvailability: {
    postsWithImageUrls: number;
    postsWithoutImageUrls: number;
    imageClassificationConfigured: boolean;
    message: string;
  };
};
type SentimentResponse = {
  configured: boolean;
  totalStoredComments: number;
  analyzedComments: number;
  counts: Record<'Positive' | 'Neutral' | 'Negative', number>;
  percentages: Record<string, number> | null;
  sentimentEngagement: Array<{
    sentiment: 'Positive' | 'Neutral' | 'Negative';
    comments: number;
    linkedPostCount: number;
    averagePostLikes: number | null;
    averagePostComments: number | null;
    averagePostEngagement: number | null;
  }>;
  message: string | null;
};
type FuzzyResponse = {
  configured: boolean;
  postCount: number;
  classifiedCount: number;
  thresholds: { minimum: number; maximum: number; membershipDomain: string } | null;
  membershipFunctions: { low: string; medium: string; high: string } | null;
  distribution: Record<'Low' | 'Medium' | 'High', number>;
  classifications: Array<{
    postKey: string;
    postUrl: string | null;
    thumbnailUrl: string | null;
    caption: string | null;
    datePosted: string | null;
    mediaType: string | null;
    engagementScore: number;
    classification: string;
    memberships: Record<string, number>;
  }>;
  message: string | null;
};
type MlResponse = { status: string; trainedModels: string[]; metrics: null; predictions: never[]; message: string };
type RecommendationsResponse = { recommendations: string[]; message: string | null };
type SettingsResponse = { services: { mongodb: string; brightData: string; ml: string } };
type ChatResponse = { answer: string };

const dashboardPages: Array<{ view: DashboardView; path: string; glyph: string }> = [
  { view: 'Overview', path: '/dashboard', glyph: '▦' },
  { view: 'Top Posts', path: '/top-posts', glyph: '▧' },
  { view: 'Hashtags', path: '/hashtags', glyph: '#' },
  { view: 'Analysis', path: '/analysis', glyph: '∿' },
  { view: 'Recommendations', path: '/recommendations', glyph: '✦' },
  { view: 'Chatbot', path: '/chatbot', glyph: '◌' },
];

function dashboardViewForPath(path: string): DashboardView {
  return dashboardPages.find((page) => page.path === path)?.view ?? 'Overview';
}

function displayCount(value: number | null): string {
  return value === null ? 'N/A' : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function getErrorMessage(error: unknown, fallback: string): string {
  return axios.isAxiosError<{ message?: string }>(error)
    ? error.response?.data?.message ?? fallback
    : fallback;
}

function isNotFound(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404;
}

function profileUsername(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .split(/[/?#]/, 1)[0]
    .toLowerCase();
}

function formatDate(value: string | null): string {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function App() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [profileInput, setProfileInput] = useState(
    () => window.localStorage.getItem('trendvision:lastUsername') || 'aliaabhatt',
  );
  const [profile, setProfile] = useState<InstagramProfile | null>(null);
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState('');
  const [error, setError] = useState('');
  const [overview, setOverview] = useState<OverviewResponse['metrics'] | null>(null);
  const [topPosts, setTopPosts] = useState<InstagramPost[]>([]);
  const [topPostsLoading, setTopPostsLoading] = useState(false);
  const [topPostsError, setTopPostsError] = useState('');
  const [topPostLimit, setTopPostLimit] = useState(5);
  const [topPostsFilter, setTopPostsFilter] = useState<TopPostsFilter>('All');
  const [topPostsSort, setTopPostsSort] = useState<TopPostsSort>('Engagement');
  const [contentAnalysis, setContentAnalysis] = useState<ContentResponse | null>(null);
  const [sentimentAnalysis, setSentimentAnalysis] = useState<SentimentResponse | null>(null);
  const [fuzzyAnalysis, setFuzzyAnalysis] = useState<FuzzyResponse | null>(null);
  const [mlAnalysis, setMlAnalysis] = useState<MlResponse | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationsResponse | null>(null);
  const [serviceStatus, setServiceStatus] = useState<SettingsResponse['services'] | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [chatQuestion, setChatQuestion] = useState('');
  const [chatAnswer, setChatAnswer] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const activeView = dashboardViewForPath(pathname);

  const readStoredProfile = async (username: string): Promise<InstagramProfile> => {
    const response = await axios.get<ProfileResponse>(
      `/api/instagram/profile/${encodeURIComponent(username)}`,
    );
    return response.data.profile;
  };

  const readStoredPosts = async (username: string): Promise<InstagramPost[]> => {
    const response = await axios.get<PostsResponse>(
      `/api/instagram/posts/${encodeURIComponent(username)}?limit=10`,
    );
    return response.data.posts;
  };

  const readStoredOverview = async (username: string): Promise<OverviewResponse> => {
    const response = await axios.get<OverviewResponse>(
      `/api/analytics/overview/${encodeURIComponent(username)}`,
    );
    return response.data;
  };

  useEffect(() => {
    let cancelled = false;
    const username = profileUsername(profileInput);
    if (!username) return () => { cancelled = true; };

    setProfileLoading(true);
    readStoredOverview(username)
      .then(async (storedOverview) => {
        if (cancelled) return;
        const storedProfile = storedOverview.profile;
        if (!storedProfile) {
          setProfile(null);
          return;
        }
        setProfile(storedProfile);
        setOverview(storedOverview.metrics);
        const storedPosts = await readStoredPosts(storedProfile.username);
        if (!cancelled) setPosts(storedPosts);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        if (!isNotFound(loadError)) {
          setError(getErrorMessage(loadError, 'Could not load saved profile data from MongoDB.'));
        }
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (pathname !== '/top-posts' || !profile) return;
    let cancelled = false;
    setTopPostsLoading(true);
    setTopPostsError('');
    axios.get<PostsResponse>(
      `/api/analytics/top-posts/${encodeURIComponent(profile.username)}?limit=${topPostLimit}&sort=${topPostsSort}&media=${topPostsFilter}`,
    )
      .then((response) => {
        if (!cancelled) setTopPosts(response.data.posts);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setTopPostsError(getErrorMessage(loadError, 'Could not load top posts from MongoDB.'));
        }
      })
      .finally(() => {
        if (!cancelled) setTopPostsLoading(false);
      });
    return () => { cancelled = true; };
  }, [pathname, profile, topPostLimit, topPostsSort, topPostsFilter]);

  useEffect(() => {
    if (!profile) return;
    const endpoints: Partial<Record<DashboardView, string>> = {
      'Content Analysis': `/api/analytics/content/${encodeURIComponent(profile.username)}`,
      'Sentiment Analysis': `/api/analytics/sentiment/${encodeURIComponent(profile.username)}`,
      Analysis: `/api/analytics/fuzzy/${encodeURIComponent(profile.username)}`,
      'ML Prediction': `/api/analytics/ml/${encodeURIComponent(profile.username)}`,
      Recommendations: `/api/recommendations/${encodeURIComponent(profile.username)}`,
      Settings: '/api/settings/status',
    };
    const endpoint = endpoints[activeView];
    if (!endpoint) return;

    let cancelled = false;
    setAnalysisLoading(true);
    setAnalysisError('');
    axios.get(endpoint)
      .then(({ data }) => {
        if (cancelled) return;
        if (activeView === 'Content Analysis') setContentAnalysis(data as ContentResponse);
        if (activeView === 'Sentiment Analysis') setSentimentAnalysis(data as SentimentResponse);
        if (activeView === 'Analysis') setFuzzyAnalysis(data as FuzzyResponse);
        if (activeView === 'ML Prediction') setMlAnalysis(data as MlResponse);
        if (activeView === 'Recommendations') setRecommendations(data as RecommendationsResponse);
        if (activeView === 'Settings') setServiceStatus((data as SettingsResponse).services);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setAnalysisError(getErrorMessage(loadError, `Could not load ${activeView.toLowerCase()} data.`));
      })
      .finally(() => {
        if (!cancelled) setAnalysisLoading(false);
      });

    return () => { cancelled = true; };
  }, [activeView, profile]);

  const submitChatQuestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile || !chatQuestion.trim()) return;
    setChatLoading(true);
    setChatError('');
    setChatAnswer('');
    try {
      const response = await axios.post<ChatResponse>('/api/chatbot', {
        username: profile.username,
        question: chatQuestion.trim(),
      });
      setChatAnswer(response.data.answer);
    } catch (requestError) {
      setChatError(getErrorMessage(requestError, 'Could not query saved profile data.'));
    } finally {
      setChatLoading(false);
    }
  };

  const analyzeProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const username = profileUsername(profileInput);
    if (!username) {
      setError('Enter an Instagram username or profile URL.');
      setProfile(null);
      setPosts([]);
      return;
    }

    setProfileLoading(true);
    setError('');
    setPostsError('');

    try {
      let storedProfile: InstagramProfile;
      try {
        storedProfile = await readStoredProfile(username);
      } catch (profileReadError) {
        if (!isNotFound(profileReadError)) throw profileReadError;
        const request = /^https?:\/\//i.test(profileInput.trim())
          ? { profileUrl: profileInput.trim() }
          : { username };
        const response = await axios.post<ProfileResponse>('/api/instagram/profile', request, { timeout: 360_000 });
        storedProfile = response.data.profile;
      }
      setProfile(storedProfile);
      window.localStorage.setItem('trendvision:lastUsername', storedProfile.username);
      const storedOverview = await readStoredOverview(storedProfile.username);
      setOverview(storedOverview.metrics);
      setProfileLoading(false);
      setPostsLoading(true);
      try {
        setPosts(await readStoredPosts(storedProfile.username));
        navigate('/dashboard');
      } catch (postsReadError) {
        setPostsError(getErrorMessage(postsReadError, 'Could not load the saved posts from MongoDB.'));
      } finally {
        setPostsLoading(false);
      }
      navigate('/dashboard');
    } catch (readError) {
      if (isNotFound(readError)) {
        setProfile(null);
        setPosts([]);
        setError('No saved profile was found in MongoDB. Use Refresh Data to explicitly fetch it from Instagram.');
      } else {
        setError(getErrorMessage(readError, 'Could not load saved profile data from MongoDB.'));
      }
    } finally {
      setProfileLoading(false);
    }
  };

  const refreshData = async () => {
    const username = profileUsername(profileInput);
    if (!username) {
      setError('Enter an Instagram username or profile URL.');
      return;
    }

    const request = /^https?:\/\//i.test(profileInput.trim())
      ? { profileUrl: profileInput.trim() }
      : { username };
    setProfileLoading(true);
    setPostsLoading(false);
    setError('');
    setPostsError('');

    let storedProfile: InstagramProfile;
    try {
      await axios.post('/api/instagram/profile', request, { timeout: 360_000 });
      storedProfile = await readStoredProfile(username);
      setProfile(storedProfile);
      window.localStorage.setItem('trendvision:lastUsername', storedProfile.username);
      const storedOverview = await readStoredOverview(storedProfile.username);
      setOverview(storedOverview.metrics);
    } catch (refreshError) {
      setError(getErrorMessage(refreshError, 'Could not refresh the Instagram profile.'));
      setProfileLoading(false);
      return;
    }

    setProfileLoading(false);
    setPostsLoading(true);
    try {
      await axios.post(
        '/api/instagram/posts',
        { profileUrl: storedProfile.profileUrl, limit: 10 },
        { timeout: 360_000 },
      );
      setPosts(await readStoredPosts(storedProfile.username));
    } catch (refreshError) {
      setPostsError(getErrorMessage(refreshError, 'Could not refresh posts. The profile was refreshed successfully.'));
    } finally {
      setPostsLoading(false);
    }
  };

  const engagementData = useMemo(() => {
    return [...posts]
      .sort((first, second) => {
        if (!first.datePosted || !second.datePosted) return 0;
        return new Date(first.datePosted).getTime() - new Date(second.datePosted).getTime();
      })
      .map((post, index) => ({
        post: `Post ${index + 1}`,
        engagement: (post.likes ?? 0) + (post.commentsCount ?? 0),
        likes: post.likes ?? 0,
        comments: post.commentsCount ?? 0,
      }));
  }, [posts]);

  const hashtagData = useMemo(() => {
    const stats = new Map<string, number>();
    posts.forEach((post) => post.hashtags.forEach((tag) => {
      const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`;
      stats.set(normalizedTag, (stats.get(normalizedTag) ?? 0) + 1);
    }));
    return [...stats.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((first, second) => second.count - first.count);
  }, [posts]);

  const rankedPosts = useMemo(() => {
    return [...posts].sort((first, second) => {
      return ((second.likes ?? 0) + (2 * (second.commentsCount ?? 0)))
        - ((first.likes ?? 0) + (2 * (first.commentsCount ?? 0)));
    });
  }, [posts]);

  const visibleTopPosts = useMemo(() => {
    const filtered = topPosts.filter((post) => {
      if (topPostsFilter === 'All') return true;
      const mediaType = (post.mediaType ?? '').toLowerCase();
      return topPostsFilter === 'Reels'
        ? mediaType.includes('reel') || mediaType.includes('video')
        : !mediaType.includes('reel') && !mediaType.includes('video');
    });
    return filtered.sort((first, second) => {
      if (topPostsSort === 'Latest') {
        return new Date(second.datePosted ?? 0).getTime() - new Date(first.datePosted ?? 0).getTime();
      }
      const value = (post: InstagramPost) => {
        if (topPostsSort === 'Likes') return post.likes ?? -1;
        if (topPostsSort === 'Comments') return post.commentsCount ?? -1;
        if (topPostsSort === 'Views') return post.views ?? -1;
        return (post.likes ?? 0) + 2 * (post.commentsCount ?? 0);
      };
      return value(second) - value(first);
    });
  }, [topPosts, topPostsFilter, topPostsSort]);

  const totalLikes = overview ? overview.totalLikes : posts.reduce((sum, post) => sum + (post.likes ?? 0), 0);
  const totalComments = overview ? overview.totalComments : posts.reduce((sum, post) => sum + (post.commentsCount ?? 0), 0);
  const totalViews = overview
    ? overview.totalViews
    : posts.some((post) => post.views !== null)
      ? posts.reduce((sum, post) => sum + (post.views ?? 0), 0)
      : null;
  const maxEngagement = Math.max(
    1,
    ...engagementData.flatMap((item) => [item.likes, item.comments]),
  );
  const isLoading = profileLoading || postsLoading;

  const renderPostCards = (items: InstagramPost[]) => (
    <div className="post-grid">
      {items.map((post, index) => {
        const image = post.imageUrls[0] ?? post.videoUrl;
        return (
          <article className="image-card" key={post.postKey}>
            {image ? (
              <img
                src={image}
                alt=""
                loading="lazy"
                onError={(event) => event.currentTarget.removeAttribute('src')}
              />
            ) : (
              <div className="post-card-empty">Instagram post</div>
            )}
            <div className="post-card-body">
              <div className="post-card-title-row">
                <span>Post {index + 1}</span>
                {post.mediaType && <small className="media-pill">{post.mediaType}</small>}
              </div>
              <time>{formatDate(post.datePosted)}</time>
              {post.caption && <p>{post.caption}</p>}
              <div className="post-card-stats">
                {post.likes !== null && <span>♥ {displayCount(post.likes)}</span>}
                {post.commentsCount !== null && <span>◌ {displayCount(post.commentsCount)}</span>}
                {post.views !== null && <span>▶ {displayCount(post.views)}</span>}
              </div>
              {post.postUrl && (
                <a href={post.postUrl} target="_blank" rel="noreferrer">Open Instagram post ↗</a>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );

  const lookupForm = (className: string) => (
    <form className={className} onSubmit={analyzeProfile}>
      <label htmlFor="username-input">Instagram username or profile URL</label>
      <div className="input-row">
        <span className="input-instagram-icon">◎</span>
        <input
          id="username-input"
          value={profileInput}
          onChange={(event) => setProfileInput(event.target.value)}
          placeholder="avantika or https://www.instagram.com/avantika/"
          autoComplete="off"
        />
        <button type="submit" disabled={isLoading}>
          {profileLoading ? 'Loading profile...' : postsLoading ? 'Loading posts...' : 'Analyze Profile'}
        </button>
      </div>
      <button className="refresh-button" type="button" onClick={refreshData} disabled={isLoading}>
        {isLoading ? 'Working...' : 'Refresh Data'}
      </button>
      {profileLoading && (
        <div className="loading-state" role="status" aria-live="polite">
          <span className="loading-spinner" />
          Loading saved profile from MongoDB...
        </div>
      )}
      {postsLoading && (
        <div className="loading-state" role="status" aria-live="polite">
          <span className="loading-spinner" />
          Loading saved posts from MongoDB...
        </div>
      )}
      {error && <div className="error-state" role="alert">{error}</div>}
      {postsError && <div className="error-state" role="alert">{postsError}</div>}
    </form>
  );

  const renderLanding = () => (
      <div className="landing-shell">
        <div className="landing-card">
          <header className="topbar landing-topbar">
            <Link className="brand-wrap" to="/" aria-label="Instagram Trend and Post Analysis home">
              <span className="brand-icon">◎</span>
              <span>Instagram Trend and Post Analysis</span>
            </Link>
            <nav className="landing-nav" aria-label="Main navigation">
              <a href="#home">Home</a>
              <a href="#features">Features</a>
              <a href="#how-it-works">How It Works</a>
              <a href="#about">About</a>
            </nav>
            <a className="nav-cta" href="#analyze">Get Started</a>
          </header>

          <main className="hero-row" id="home">
            <div className="headline-block">
              <span className="hero-eyebrow">Public Instagram analytics</span>
              <h1>Instagram Post &amp; Trend Analysis</h1>
              <p>
                Explore the latest available public profile and post data, stored for quick access in your dashboard.
              </p>
              {lookupForm('input-panel landing-input')}
              <div className="landing-feature-row" id="features">
                <div><span>✦</span><strong>Public profile insights</strong></div>
                <div><span>♡</span><strong>Post performance</strong></div>
                <div><span>⌕</span><strong>Hashtag overview</strong></div>
              </div>
            </div>

            <motion.div
              className="landing-art"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
            >
              <div className="art-glow" />
              <div className="landing-avatar avatar-placeholder">◎</div>
              <div className="art-post-preview">
                <div className="art-post-thumb">
                  {posts[0]?.imageUrls[0] && <img src={posts[0].imageUrls[0]} alt="" />}
                </div>
                <div className="art-post-details">
                  <strong>Saved public posts</strong>
                  <span>Stored in your MongoDB dashboard</span>
                </div>
                <span className="art-heart">♥</span>
              </div>
              <div className="art-float art-float-top">✦ Instagram insights</div>
              <div className="art-float art-float-bottom">◎ MongoDB first</div>
            </motion.div>
          </main>

          <footer className="landing-footer" id="how-it-works">
            <span>Instagram Trend and Post Analysis</span>
            <span id="about">Public Instagram insights</span>
          </footer>
        </div>
      </div>
    );

  const renderDashboard = (view: DashboardView) => {
    if (!profile) {
      return (
        <main className="content-area">
          {profileLoading ? (
            <div className="loading-state" role="status">Loading saved dashboard data from MongoDB...</div>
          ) : (
            <div className="chart-empty">No saved profile is loaded. Analyze a profile to continue.</div>
          )}
        </main>
      );
    }
    return (
      <div className="dashboard-shell">
      <aside className="sidebar">
        <Link className="brand-wrap sidebar-brand" to="/" aria-label="Instagram Trend and Post Analysis home">
          <span className="brand-icon">◎</span>
          <span>Instagram Trend and Post Analysis</span>
        </Link>
        <div className="sidebar-caption">WORKSPACE</div>
        <nav className="nav-list" aria-label="Analytics pages">
          {dashboardPages.map((page) => (
            <Link className={view === page.view ? 'nav-item active' : 'nav-item'} to={page.path} key={page.path}>
              <span className="nav-glyph">{page.glyph}</span>{page.view}
            </Link>
          ))}
        </nav>
        <div className="sidebar-note">
          
        </div>
      </aside>

      <main className="content-area">
        <header className="dashboard-header">
          <div>
            <span className="eyebrow">INSTAGRAM ANALYTICS</span>
            <h1>{view}</h1>
          </div>
          <div className="dashboard-header-actions">
            {lookupForm('dashboard-lookup')}
            <div className="header-profile">
              {profile.profileImage ? (
                <img src={profile.profileImage} alt="" />
              ) : (
                <div className="header-avatar-placeholder">{profile.username.slice(0, 1).toUpperCase()}</div>
              )}
              <span>@{profile.username}</span>
            </div>
          </div>
        </header>

        <div className="status-banner">
          <span className="status-dot" />
          
          <span className="status-separator">·</span>
          <span>{profile.updatedAt ? `Updated ${formatDate(profile.updatedAt)}` : 'Showing latest saved profile and posts'}</span>
        </div>
        {error && <div className="error-state dashboard-error" role="alert">{error}</div>}

        {view === 'Overview' && (
          <>
            <section className="dashboard-profile panel">
              <div className="dashboard-profile-main">
                {profile.profileImage ? (
                  <img className="dashboard-avatar" src={profile.profileImage} alt="" />
                ) : (
                  <div className="dashboard-avatar header-avatar-placeholder">{profile.username.slice(0, 1).toUpperCase()}</div>
                )}
                <div>
                  <h2>
                    {profile.fullName || `@${profile.username}`}
                    {profile.verified && <span className="verified-badge" aria-label="Verified">✓</span>}
                  </h2>
                  <a href={profile.profileUrl} target="_blank" rel="noreferrer">@{profile.username}</a>
                  {profile.biography && <p>{profile.biography}</p>}
                </div>
              </div>
              <div className="dashboard-profile-stats">
                <div><strong>{displayCount(profile.followers)}</strong><span>Followers</span></div>
                <div><strong>{displayCount(profile.following)}</strong><span>Following</span></div>
                <div><strong>{displayCount(profile.postsCount)}</strong><span>Profile posts</span></div>
              </div>
            </section>

            <section className="metric-grid" aria-label="Saved post metrics">
              <div className="metric-tile"><span className="metric-icon pink">♥</span><span>Total Likes</span><strong>{displayCount(totalLikes)}</strong></div>
              <div className="metric-tile"><span className="metric-icon purple">◌</span><span>Total Comments</span><strong>{displayCount(totalComments)}</strong></div>
              <div className="metric-tile"><span className="metric-icon blue">♥</span><span>Average Likes/Post</span><strong>{displayCount(overview?.averageLikes ?? null)}</strong></div>
              <div className="metric-tile"><span className="metric-icon purple">◌</span><span>Average Comments/Post</span><strong>{displayCount(overview?.averageComments ?? null)}</strong></div>
              <div className="metric-tile"><span className="metric-icon blue">▶</span><span>Available Views</span><strong>{displayCount(totalViews)}</strong></div>
              <div className="metric-tile"><span className="metric-icon green">▧</span><span>Engagement Score</span><strong>{totalLikes !== null && totalComments !== null ? displayCount(totalLikes + 2 * totalComments) : 'N/A'}</strong></div>
              <div className="metric-tile"><span className="metric-icon green">▧</span><span>Saved Posts</span><strong>{displayCount(overview?.postCount ?? null)}</strong></div>
            </section>

            <section className="dashboard-grid">
              <div className="panel chart-panel">
                <div className="panel-heading">
                  <div><h2>Post Engagement</h2><p>Likes and comments in saved public posts</p></div>
                  <span className="chart-legend"><i /> Likes <i className="legend-pink" /> Comments</span>
                </div>
                {engagementData.length ? (
                  <div className="engagement-plot">
                    <div className="chart-y-labels">
                      <span>{displayCount(maxEngagement)}</span>
                      <span>{displayCount(Math.round(maxEngagement / 2))}</span>
                      <span>0</span>
                    </div>
                    <div className="chart-columns">
                      {engagementData.map((item) => (
                        <div className="chart-column" key={item.post} title={`${item.post}: ${displayCount(item.likes)} likes, ${displayCount(item.comments)} comments`}>
                          <div className="chart-bars">
                            <span className="chart-bar likes-bar" style={{ height: `${Math.max((item.likes / maxEngagement) * 100, item.likes ? 2 : 0)}%` }} />
                            <span className="chart-bar comments-bar" style={{ height: `${Math.max((item.comments / maxEngagement) * 100, item.comments ? 2 : 0)}%` }} />
                          </div>
                          <small>{item.post.replace('Post ', '#')}</small>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="chart-empty">No saved engagement data yet.</div>
                )}
              </div>

              <div className="panel hashtag-panel">
                <div className="panel-heading">
                  <div><h2>Top Hashtags</h2><p>From your saved posts</p></div>
                  <Link className="text-button" to="/top-posts">View top posts</Link>
                </div>
                {hashtagData.length ? (
                  <div className="hashtag-list">
                    {hashtagData.slice(0, 7).map((item, index) => (
                      <div className="hashtag-row" key={item.tag}>
                        <span className="hashtag-rank">{String(index + 1).padStart(2, '0')}</span>
                        <strong>{item.tag}</strong>
                        <span>{item.count} {item.count === 1 ? 'post' : 'posts'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="chart-empty">No hashtags were returned in saved posts.</div>
                )}
              </div>
            </section>

            <section className="panel dashboard-posts-panel">
              <div className="panel-heading">
                <div><h2>Top Performing Posts</h2></div>
                <Link className="text-button" to="/top-posts">See all posts</Link>
              </div>
              {postsError && <div className="error-state" role="alert">{postsError}</div>}
              {posts.length ? renderPostCards(rankedPosts.slice(0, 4)) : (
                <div className="chart-empty">No posts are saved for this profile yet. Use Refresh Data to fetch public posts.</div>
              )}
            </section>
          </>
        )}

        {view === 'Top Posts' && (
          <section className="panel page-panel">
            <div className="panel-heading">
              <div><h2>Top Performing Posts</h2><p>Ranked by likes + (2 × comments), from MongoDB</p></div>
              <span className="saved-count">{topPosts.length} saved</span>
            </div>
            <div className="top-post-filters">
              <div className="filter-group" aria-label="Filter post media">
                {(['All', 'Posts', 'Reels'] as TopPostsFilter[]).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    className={topPostsFilter === filter ? 'filter-button active' : 'filter-button'}
                    onClick={() => setTopPostsFilter(filter)}
                  >{filter}</button>
                ))}
              </div>
              <label>Sort by
                <select value={topPostsSort} onChange={(event) => setTopPostsSort(event.target.value as TopPostsSort)}>
                  {(['Engagement', 'Likes', 'Comments', 'Views', 'Latest'] as TopPostsSort[]).map((sort) => (
                    <option key={sort}>{sort}</option>
                  ))}
                </select>
              </label>
              <label>Show
                <select value={topPostLimit} onChange={(event) => setTopPostLimit(Number(event.target.value))}>
                  {[5, 10, 20].map((limit) => <option key={limit} value={limit}>Top {limit}</option>)}
                </select>
              </label>
            </div>
            {topPostsLoading && <div className="loading-state" role="status">Loading top posts from MongoDB...</div>}
            {topPostsError && <div className="error-state" role="alert">{topPostsError}</div>}
            {postsError && <div className="error-state" role="alert">{postsError}</div>}
            {!topPostsLoading && !topPostsError && visibleTopPosts.length ? renderPostCards(visibleTopPosts) : null}
            {!topPostsLoading && !topPostsError && !visibleTopPosts.length ? (
              <div className="chart-empty">No posts are saved for this profile yet. Use Refresh Data to fetch public posts.</div>
            ) : null}
            <div className="top-post-table-wrap">
              <table className="top-post-table">
                <thead><tr><th>Post</th><th>Date</th><th>Media</th><th>Likes</th><th>Comments</th><th>Views</th><th>Engagement score</th></tr></thead>
                <tbody>
                  {visibleTopPosts.map((post) => (
                    <tr key={post.postKey}>
                      <td>{post.caption?.slice(0, 70) || 'Caption unavailable'}</td>
                      <td>{formatDate(post.datePosted)}</td>
                      <td>{post.mediaType || 'N/A'}</td>
                      <td>{displayCount(post.likes)}</td>
                      <td>{displayCount(post.commentsCount)}</td>
                      <td>{displayCount(post.views)}</td>
                      <td>{post.likes === null && post.commentsCount === null ? 'N/A' : displayCount((post.likes ?? 0) + 2 * (post.commentsCount ?? 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        {view === 'Hashtags' && (
          <section className="panel page-panel">
            <div className="panel-heading">
              <div><h2>Hashtag Analysis</h2><p>Hashtags counted from saved posts only</p></div>
              <span className="saved-count">{hashtagData.length} tags</span>
            </div>
            {hashtagData.length ? (
              <div className="hashtag-cloud">
                {hashtagData.map((item, index) => (
                  <div className={`hashtag-chip size-${Math.min(index, 3)}`} key={item.tag}>
                    <strong>{item.tag}</strong><span>{item.count} posts</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="chart-empty">No hashtags were returned in saved posts.</div>
            )}
          </section>
        )}
        {view === 'Content Analysis' && (
          <section className="panel page-panel">
            <div className="panel-heading">
              <div><h2>Content &amp; Image Analysis</h2><p>Media performance calculated from saved posts</p></div>
              <span className="saved-count">{contentAnalysis?.postCount ?? 0} posts</span>
            </div>
            {analysisLoading && <div className="loading-state" role="status">Loading content analysis from MongoDB...</div>}
            {analysisError && <div className="error-state" role="alert">{analysisError}</div>}
            {!analysisLoading && contentAnalysis && (
              <>
                {contentAnalysis.mediaPerformance.length ? (
                  <div className="top-post-table-wrap">
                    <table className="top-post-table">
                      <thead><tr><th>Media type</th><th>Posts</th><th>Average likes</th><th>Average comments</th><th>Average views</th></tr></thead>
                      <tbody>{contentAnalysis.mediaPerformance.map((item) => (
                        <tr key={item.mediaType}>
                          <td>{item.mediaType}</td><td>{item.count}</td>
                          <td>{item.averageLikes === null ? 'N/A' : displayCount(item.averageLikes)}</td>
                          <td>{item.averageComments === null ? 'N/A' : displayCount(item.averageComments)}</td>
                          <td>{item.averageViews === null ? 'N/A' : displayCount(item.averageViews)}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                ) : <div className="chart-empty">No saved posts are available for content analysis.</div>}
                <div className="panel-subsection">
                  <h3>Image category analysis</h3>
                  <p>Image-category analysis uses a vision model to identify subjects or scenes in post images. Example labels might include food, nature, or fashion; these are examples, not results for this profile.</p>
                  <p>Image URLs are present for {contentAnalysis.imageAvailability.postsWithImageUrls} of {contentAnalysis.postCount} saved posts.</p>
                  <div className="info-state">{contentAnalysis.imageAvailability.message}</div>
                </div>
                <p className="phase-label">Observed averages describe this saved dataset and do not imply content causes engagement.</p>
              </>
            )}
          </section>
        )}
        {view === 'Sentiment Analysis' && (
          <section className="sentiment-page">
            <header className="sentiment-page-header">
              <div>
                <span className="eyebrow">COMMENT INSIGHTS</span>
                <h2>Comment Sentiment Analysis</h2>
                <p>Sentiment distribution and the saved-post engagement associated with each group.</p>
              </div>
            </header>

            <p className="sentiment-credit-note">Bright Data comment fetching is paused because credits are exhausted. This page reads saved MongoDB comments only; no scraper request will be sent.</p>
            {analysisLoading && <div className="loading-state" role="status">Loading stored sentiment from MongoDB...</div>}
            {analysisError && <div className="error-state" role="alert">{analysisError}</div>}

            {!analysisLoading && sentimentAnalysis?.configured && (
              <>
                <div className="sentiment-summary-grid">
                  {(['Positive', 'Neutral', 'Negative'] as const).map((label) => (
                    <article className={`sentiment-summary-card ${label.toLowerCase()}`} key={label}>
                      <span className="sentiment-summary-icon" aria-hidden="true">{label === 'Positive' ? '☺' : label === 'Neutral' ? '◉' : '☹'}</span>
                      <div>
                        <strong>{sentimentAnalysis.percentages?.[label]?.toFixed(1)}%</strong>
                        <span>{label}</span>
                        <small>{sentimentAnalysis.counts[label].toLocaleString()} comments</small>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="sentiment-analysis-grid">
                  <section className="panel sentiment-visual-panel">
                    <div className="sentiment-panel-heading">
                      <div><h3>Overall Sentiment Distribution</h3><p>{sentimentAnalysis.analyzedComments.toLocaleString()} classified comments</p></div>
                    </div>
                    <div className="sentiment-donut-layout">
                      <div
                        className="sentiment-donut"
                        role="img"
                        aria-label={`Comment sentiment distribution: ${sentimentAnalysis.percentages?.Positive?.toFixed(1)}% positive, ${sentimentAnalysis.percentages?.Neutral?.toFixed(1)}% neutral, ${sentimentAnalysis.percentages?.Negative?.toFixed(1)}% negative`}
                        style={{
                          background: `conic-gradient(#20b879 0% ${sentimentAnalysis.percentages?.Positive ?? 0}%, #4d83f4 ${sentimentAnalysis.percentages?.Positive ?? 0}% ${(sentimentAnalysis.percentages?.Positive ?? 0) + (sentimentAnalysis.percentages?.Neutral ?? 0)}%, #f05d6e ${(sentimentAnalysis.percentages?.Positive ?? 0) + (sentimentAnalysis.percentages?.Neutral ?? 0)}% 100%)`,
                        }}
                      >
                        <div className="sentiment-donut-center">
                          <strong>{sentimentAnalysis.analyzedComments.toLocaleString()}</strong>
                          <span>Comments</span>
                        </div>
                      </div>
                      <div className="sentiment-donut-legend">
                        {(['Positive', 'Neutral', 'Negative'] as const).map((label) => (
                          <div key={label}>
                            <i className={`sentiment-legend-dot ${label.toLowerCase()}`} />
                            <span>{label}</span>
                            <strong>{sentimentAnalysis.percentages?.[label]?.toFixed(1)}%</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>

                  <section className="panel sentiment-visual-panel">
                    <div className="sentiment-panel-heading">
                      <div><h3>Sentiment vs Engagement</h3><p>Average likes and comments on linked posts</p></div>
                      <div className="sentiment-chart-legend"><span><i className="likes-legend" /> Avg likes</span><span><i className="comments-legend" /> Avg comments</span></div>
                    </div>
                    <div className="sentiment-engagement-chart">
                      {sentimentAnalysis.sentimentEngagement.map((item) => {
                        const hasLinkedPosts = item.linkedPostCount > 0;
                        const scale = Math.max(1, ...sentimentAnalysis.sentimentEngagement.flatMap((group) => [
                          group.averagePostLikes ?? 0,
                          group.averagePostComments ?? 0,
                        ]));
                        return (
                          <div className="sentiment-engagement-group" key={item.sentiment}>
                            <div className="sentiment-engagement-bars">
                              {hasLinkedPosts ? (
                                <>
                                  <span
                                    className="sentiment-engagement-bar likes"
                                    style={{ height: `${Math.max(4, ((item.averagePostLikes ?? 0) / scale) * 100)}%` }}
                                    title={`Average likes: ${displayCount(item.averagePostLikes)}`}
                                  />
                                  <span
                                    className="sentiment-engagement-bar comments"
                                    style={{ height: `${Math.max(4, ((item.averagePostComments ?? 0) / scale) * 100)}%` }}
                                    title={`Average comments: ${displayCount(item.averagePostComments)}`}
                                  />
                                </>
                              ) : <span className="sentiment-engagement-na">N/A</span>}
                            </div>
                            <strong>{item.sentiment}</strong>
                            <small>{item.comments} comments · {item.linkedPostCount} posts</small>
                          </div>
                        );
                      })}
                    </div>
                    <p className="sentiment-chart-footnote">Post metrics are averaged once per unique linked post, not once per comment. Groups without linked posts show N/A.</p>
                  </section>
                </div>
              </>
            )}

            {!analysisLoading && sentimentAnalysis && !sentimentAnalysis.configured && (
              <section className="panel sentiment-empty-panel">
                <span className="sentiment-empty-icon">♡</span>
                <h3>Sentiment insights will appear here</h3>
                <p>{sentimentAnalysis.message}</p>
                <small>{sentimentAnalysis.totalStoredComments.toLocaleString()} comments stored · {sentimentAnalysis.analyzedComments.toLocaleString()} analyzed</small>
              </section>
            )}
          </section>
        )}
        {view === 'Analysis' && (
          <section className="panel page-panel">
            <div className="panel-heading">
              <span className="saved-count">{fuzzyAnalysis?.classifiedCount ?? 0} classified</span>
            </div>
            {analysisLoading && <div className="loading-state" role="status">Calculating classifications from MongoDB metrics...</div>}
            {analysisError && <div className="error-state" role="alert">{analysisError}</div>}
            {!analysisLoading && fuzzyAnalysis && (
              fuzzyAnalysis.configured ? (
                <>
                  <div className="fuzzy-summary-grid">{(['Low', 'Medium', 'High'] as const).map((label) => (
                    <div className={`fuzzy-summary-card ${label.toLowerCase()}`} key={label}>
                      <span>{label} engagement</span>
                      <strong>{fuzzyAnalysis.distribution[label]}</strong>
                    </div>
                  ))}</div>
                  
                  <div className="top-post-table-wrap"><table className="top-post-table">
                    <thead><tr><th>Post</th><th>Score</th><th>Low membership</th><th>Medium membership</th><th>High membership</th><th>Classification</th></tr></thead>
                    <tbody>{fuzzyAnalysis.classifications.map((item) => (
                      <tr key={item.postKey}>
                        <td className="fuzzy-post-cell">
                          {item.thumbnailUrl ? (
                            <img
                              className="fuzzy-post-thumbnail"
                              src={item.thumbnailUrl}
                              alt={item.caption || 'Instagram post thumbnail'}
                              loading="lazy"
                              onError={(event) => event.currentTarget.style.visibility = 'hidden'}
                            />
                          ) : <span className="fuzzy-thumbnail-placeholder">No image</span>}
                          <div className="fuzzy-post-label">
                            {item.postUrl ? <a href={item.postUrl} target="_blank" rel="noreferrer">{item.mediaType || 'Open post'}</a> : <span>{item.mediaType || 'Post'}</span>}
                            <small>{formatDate(item.datePosted)}{item.caption ? ` · ${item.caption.slice(0, 55)}` : ''}</small>
                          </div>
                        </td>
                        <td>{displayCount(item.engagementScore)}</td>
                        <td>{item.memberships.Low.toFixed(2)}</td><td>{item.memberships.Medium.toFixed(2)}</td><td>{item.memberships.High.toFixed(2)}</td><td>{item.classification}</td>
                      </tr>
                    ))}</tbody>
                  </table></div>
                </>
              ) : <div className="chart-empty">{fuzzyAnalysis.message}</div>
            )}
          </section>
        )}
        {view === 'ML Prediction' && (
          <section className="panel page-panel">
            <div className="panel-heading">
              <div><h2>Post Performance Prediction</h2><p>Random Forest and AdaBoost model status</p></div>
              <span className="saved-count">Not trained</span>
            </div>
            {analysisLoading && <div className="loading-state" role="status">Checking saved model status...</div>}
            {analysisError && <div className="error-state" role="alert">{analysisError}</div>}
            {!analysisLoading && mlAnalysis && (
              <div className="chart-empty">
                <strong>{mlAnalysis.message}</strong>
                <p>No accuracy, precision, recall, F1, confusion matrix, or confidence values are shown without a trained and evaluated model.</p>
              </div>
            )}
          </section>
        )}
        {view === 'Recommendations' && (
          <section className="panel page-panel">
            <div className="panel-heading">
              <div><h2>Data-based Recommendations</h2><p>Descriptive observations from saved posts</p></div>
            </div>
            {analysisLoading && <div className="loading-state" role="status">Generating observations from MongoDB...</div>}
            {analysisError && <div className="error-state" role="alert">{analysisError}</div>}
            {!analysisLoading && recommendations && (recommendations.recommendations.length ? (
              <div className="recommendation-list">{recommendations.recommendations.map((item) => <article className="recommendation-card" key={item}>{item}</article>)}</div>
            ) : <div className="chart-empty">{recommendations.message}</div>)}
          </section>
        )}
        {view === 'Chatbot' && (
          <section className="panel page-panel">
            <div className="panel-heading">
              <div><h2>Instagram Analytics Chatbot</h2><p>Ask about saved posts, hashtags, recommendations, and fuzzy engagement categories.</p></div>
            </div>
            <form className="chat-form" onSubmit={submitChatQuestion}>
              <label htmlFor="chat-question">Ask about your saved data</label>
              <div className="input-row"><input id="chat-question" value={chatQuestion} onChange={(event) => setChatQuestion(event.target.value)} placeholder="Which post performed best?" /><button type="submit" disabled={chatLoading || !chatQuestion.trim()}>{chatLoading ? 'Checking data...' : 'Ask'}</button></div>
            </form>
            <div className="chat-suggestions">
              {['Which post performed best?', 'Which posts are high engagement?', 'What recommendations do you have?', 'Which hashtags were used most often?'].map((question) => (
                <button type="button" key={question} onClick={() => setChatQuestion(question)}>{question}</button>
              ))}
            </div>
            {chatError && <div className="error-state" role="alert">{chatError}</div>}
            {chatAnswer && <div className="chat-answer" role="status">{chatAnswer}</div>}
          </section>
        )}
        {view === 'Settings' && (
          <section className="panel page-panel">
            <div className="panel-heading"><div><h2>Settings &amp; Service Status</h2><p>Configuration status only; secrets are never returned</p></div></div>
            {analysisLoading && <div className="loading-state" role="status">Checking service status...</div>}
            {analysisError && <div className="error-state" role="alert">{analysisError}</div>}
            {serviceStatus && (
              <>
                <div className="service-list">
                  <div><span>Data source · MongoDB</span><strong>{serviceStatus.mongodb}</strong></div>
                  <div><span>External scraper · Bright Data</span><strong>{serviceStatus.brightData}</strong></div>
                  <div><span>ML service</span><strong>{serviceStatus.ml}</strong></div>
                </div>
                <p className="phase-label">Bright Data is only contacted by the explicit Refresh Data action.</p>
              </>
            )}
          </section>
        )}
        {view === 'Architecture' && (
          <section className="panel page-panel">
            <div className="panel-heading"><div><h2>Architecture / How It Works</h2><p>Current implementation and planned integrations</p></div></div>
            <div className="architecture-flow">
              <article><strong>React Frontend</strong><span>React Router pages; dashboard navigation loads stored data via API GETs.</span></article>
              <article><strong>Node.js / Express</strong><span>Validates requests and calculates descriptive analytics from MongoDB records.</span></article>
              <article><strong>Bright Data</strong><span>Explicit refresh only; scraped profile/posts are normalized by the backend.</span></article>
              <article><strong>MongoDB</strong><span>Primary dashboard source for profiles, posts, comments, and stored analyses.</span></article>
              <article><strong>Analysis services</strong><span>Media metrics and fuzzy scores use stored values. Image classification, sentiment processing, and trained ML prediction are not configured.</span></article>
            </div>
          </section>
        )}
      </main>
      </div>
    );
  };

  return (
    <Routes>
      <Route path="/" element={renderLanding()} />
      <Route path="/dashboard" element={profile ? renderDashboard('Overview') : renderLanding()} />
      <Route path="/top-posts" element={profile ? renderDashboard('Top Posts') : renderLanding()} />
      <Route path="/hashtags" element={profile ? renderDashboard('Hashtags') : renderLanding()} />
      {dashboardPages.slice(3).map((page) => (
        <Route key={page.path} path={page.path} element={profile ? renderDashboard(page.view) : renderLanding()} />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
