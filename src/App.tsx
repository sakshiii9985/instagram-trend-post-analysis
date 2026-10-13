import { useMemo, useState } from "react";

type Page =
  | "Overview"
  | "Top Posts"
  | "Hashtags"
  | "Analysis"
  | "Recommendations"
  | "Chatbot";
type PostType = "Post" | "Reel";
type Post = {
  id: number;
  date: string;
  caption: string;
  type: PostType;
  likes: number;
  comments: number;
  views: number | null;
  tags: string[];
  link?: string;
  art: string;
};

const pages: Page[] = [
  "Overview",
  "Top Posts",
  "Hashtags",
  "Analysis",
  "Recommendations",
  "Chatbot",
];

const posts: Post[] = [
  { id: 1, date: "May 18, 2025", caption: "Slow mornings, strong coffee, and a fresh page.", type: "Post", likes: 2840, comments: 164, views: null, tags: ["morningritual", "creativelife", "coffeetime"], link: "https://instagram.com/p/sample1", art: "peach" },
  { id: 2, date: "May 14, 2025", caption: "Three ways I reset my workspace for a new week.", type: "Reel", likes: 4120, comments: 238, views: 28600, tags: ["desksetup", "productivity", "creativelife"], link: "https://instagram.com/reel/sample2", art: "violet" },
  { id: 3, date: "May 9, 2025", caption: "A little color study from this weekend.", type: "Post", likes: 1960, comments: 91, views: null, tags: ["colorstudy", "designinspo", "weekendart"], art: "blue" },
  { id: 4, date: "May 3, 2025", caption: "Behind the scenes: bringing this concept to life.", type: "Reel", likes: 3650, comments: 205, views: 21900, tags: ["behindthescenes", "designprocess", "creativelife"], link: "https://instagram.com/reel/sample4", art: "rose" },
  { id: 5, date: "Apr 28, 2025", caption: "Five details I noticed on today's city walk.", type: "Post", likes: 1420, comments: 73, views: null, tags: ["citywalk", "visualdiary", "designinspo"], link: "https://instagram.com/p/sample5", art: "mint" },
  { id: 6, date: "Apr 21, 2025", caption: "A quick studio tour and what is on my shelf.", type: "Reel", likes: 2210, comments: 126, views: 15800, tags: ["studiotour", "desksetup", "creativeprocess"], art: "amber" },
  { id: 7, date: "Apr 15, 2025", caption: "Notes from a week of making more, scrolling less.", type: "Post", likes: 980, comments: 64, views: null, tags: ["creativelife", "mindfulmaking", "visualdiary"], art: "lilac" },
  { id: 8, date: "Apr 8, 2025", caption: "The tiny tools that make a big difference.", type: "Post", likes: 1170, comments: 48, views: null, tags: ["designtools", "productivity", "desksetup"], art: "coral" },
];

const score = (post: Post) => post.likes + post.comments * 2;
const compact = (value: number | null) =>
  value === null ? "N/A" : new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
const full = (value: number | null) => value === null ? "N/A" : value.toLocaleString();

function Icon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    Overview: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    "Top Posts": <><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/></>,
    Hashtags: <><path d="M10 3 8 21M16 3l-2 18M4 9h17M3 15h17"/></>,
    Analysis: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
    Recommendations: <><path d="M9 18h6M10 22h4M8.5 14.5a7 7 0 1 1 7 0c-.9.7-1.5 1.5-1.5 2.5h-4c0-1-.6-1.8-1.5-2.5Z"/></>,
    Chatbot: <><path d="M4 5h16v12H9l-5 4V5Z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/></>,
    arrow: <><path d="m9 18 6-6-6-6"/></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M18.5 9A7 7 0 0 0 6 6.5L4 9m2 6a7 7 0 0 0 12.5 2.5L20 15"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    external: <><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v6H5V6h6"/></>,
  };
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Button({ children, variant = "primary", onClick, type = "button", disabled = false, className = "" }: {
  children: React.ReactNode; variant?: "primary" | "secondary" | "ghost"; onClick?: () => void;
  type?: "button" | "submit"; disabled?: boolean; className?: string;
}) {
  return <button className={`button button-${variant} ${className}`} onClick={onClick} type={type} disabled={disabled}>{children}</button>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="label">{children}</span>;
}

function EmptyState({ title, copy }: { title: string; copy: string }) {
  return <div className="empty-state"><div className="empty-icon"><Icon name="search" /></div><strong>{title}</strong><p>{copy}</p></div>;
}

function Art({ variant, large = false }: { variant: string; large?: boolean }) {
  return <div className={`post-art art-${variant} ${large ? "post-art-large" : ""}`}><span className="art-shape art-one" /><span className="art-shape art-two" /><span className="art-mark">AC</span></div>;
}

function SampleLabel() {
  return <span className="sample-label"><span />Illustrative prototype data</span>;
}

function Home({ onComplete }: { onComplete: (empty: boolean) => void }) {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error" | "empty">("idle");

  function analyze() {
    if (!input.trim()) { setStatus("empty"); return; }
    setStatus("loading");
    window.setTimeout(() => {
      if (input.toLowerCase().includes("error")) { setStatus("error"); return; }
      setStatus("success");
      window.setTimeout(() => onComplete(input.toLowerCase().includes("empty")), 650);
    }, 800);
  }

  return <main className="home-shell">
    <div className="home-orb home-orb-one" /><div className="home-orb home-orb-two" />
    <header className="home-header"><Brand /><SampleLabel /></header>
    <section className="home-content">
      <div className="home-copy">
        <span className="eyebrow">Social content workspace</span>
        <h1>Make sense of your<br/><em>Instagram content.</em></h1>
        <p>Explore post performance, identify patterns, and turn a saved profile dataset into clear, descriptive observations.</p>
        <div className="feature-row"><span>01</span><p><strong>Compare content</strong> across posts and reels</p></div>
        <div className="feature-row"><span>02</span><p><strong>Spot patterns</strong> in engagement and hashtags</p></div>
        <div className="feature-row"><span>03</span><p><strong>Ask questions</strong> about saved prototype data</p></div>
      </div>
      <div className="lookup-card">
        <div className="lookup-top"><span className="mini-label">Profile analysis</span><span className="status-dot">Prototype</span></div>
        <h2>Start with a profile</h2>
        <p>Enter an Instagram username or public profile URL to load the illustrative dataset.</p>
        <form onSubmit={(event) => { event.preventDefault(); analyze(); }}>
          <label><Label>Instagram username or profile URL</Label>
            <div className="input-wrap"><span>@</span><input value={input} onChange={(event) => { setInput(event.target.value); setStatus("idle"); }} placeholder="username or instagram.com/username" /></div>
          </label>
          <div className="home-actions">
            <Button type="submit" disabled={status === "loading"}>{status === "loading" ? <><span className="spinner"/>Analyzing...</> : <>Analyze Profile <Icon name="arrow" /></>}</Button>
            <Button variant="secondary" onClick={() => { setInput(""); setStatus("idle"); }}><Icon name="refresh" /> Refresh Data</Button>
          </div>
        </form>
        {status === "empty" && <div className="notice notice-empty"><strong>A profile is needed</strong><span>Enter a username or URL to continue.</span></div>}
        {status === "error" && <div className="notice notice-error"><strong>We couldn't load that sample</strong><span>This is a simulated error. Try another name.</span></div>}
        {status === "success" && <div className="notice notice-success"><strong>Sample profile ready</strong><span>Opening your overview...</span></div>}
        <p className="try-note">Prototype tip: use <button type="button" onClick={() => setInput("@empty")}>@empty</button> or <button type="button" onClick={() => setInput("@error")}>@error</button> to test alternate states.</p>
      </div>
    </section>
    <footer>Independent analysis prototype • No connection to Instagram or external services</footer>
  </main>;
}

function Brand() {
  return <div className="brand"><div className="brand-mark"><span /></div><div><strong>Post<span>Pulse</span></strong><small>Trend & post analysis</small></div></div>;
}

function AppShell({ empty, onHome }: { empty: boolean; onHome: () => void }) {
  const [page, setPage] = useState<Page>("Overview");
  const [refreshing, setRefreshing] = useState(false);
  const data = empty ? [] : posts;
  const refresh = () => { setRefreshing(true); window.setTimeout(() => setRefreshing(false), 900); };

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand-button" onClick={onHome}><Brand /></button>
      <nav aria-label="Dashboard pages">
        <span className="nav-label">Workspace</span>
        {pages.map((item) => <button key={item} onClick={() => setPage(item)} className={page === item ? "nav-item active" : "nav-item"}><Icon name={item}/><span>{item}</span>{page === item && <i />}</button>)}
      </nav>
      <div className="sidebar-note"><span className="sidebar-note-icon">i</span><div><strong>Prototype mode</strong><p>No live Instagram connection</p></div></div>
      <button className="profile-mini" onClick={() => setPage("Overview")}><div className="avatar avatar-small">AC</div><div><strong>@ateliercommon</strong><span>Saved profile</span></div><Icon name="arrow"/></button>
    </aside>
    <main className="dashboard">
      <header className="topbar">
        <div><span className="breadcrumb">Dashboard /</span><strong>{page}</strong></div>
        <div className="top-actions"><SampleLabel /><Button variant="secondary" onClick={refresh} disabled={refreshing}><Icon name="refresh" />{refreshing ? "Refreshing..." : "Refresh data"}</Button></div>
      </header>
      {refreshing && <div className="refresh-line"><span /></div>}
      <div className="page-wrap">
        {page === "Overview" && <Overview data={data} navigate={setPage} />}
        {page === "Top Posts" && <TopPosts data={data} />}
        {page === "Hashtags" && <Hashtags data={data} />}
        {page === "Analysis" && <Analysis data={data} />}
        {page === "Recommendations" && <Recommendations data={data} />}
        {page === "Chatbot" && <Chatbot data={data} />}
      </div>
    </main>
  </div>;
}

function PageHeading({ kicker, title, copy }: { kicker: string; title: string; copy: string }) {
  return <div className="page-heading"><span className="eyebrow">{kicker}</span><h1>{title}</h1><p>{copy}</p></div>;
}

function Overview({ data, navigate }: { data: Post[]; navigate: (page: Page) => void }) {
  const likes = data.reduce((sum, item) => sum + item.likes, 0);
  const comments = data.reduce((sum, item) => sum + item.comments, 0);
  const views = data.reduce((sum, item) => sum + (item.views || 0), 0);
  if (!data.length) return <><PageHeading kicker="Profile snapshot" title="Overview" copy="A clear view of the saved profile and its content performance."/><EmptyState title="No saved posts yet" copy="This illustrative profile has no saved content. Return home and analyze another sample profile." /></>;
  return <>
    <PageHeading kicker="Profile snapshot" title="Good afternoon, Alex." copy="Here is how @ateliercommon's saved content is performing."/>
    <section className="profile-card">
      <div className="profile-main"><div className="avatar">AC</div><div><div className="profile-title"><h2>@ateliercommon</h2><span>Saved sample</span></div><p>Design notes, slow living, and creative process. Sharing what I learn along the way.</p></div></div>
      <div className="profile-counts"><div><strong>48.2K</strong><span>Followers</span></div><div><strong>1,204</strong><span>Following</span></div><div><strong>186</strong><span>Posts</span></div></div>
    </section>
    <div className="metric-grid">
      <Metric label="Saved-post likes" value={compact(likes)} change="Across 8 posts" icon="heart"/>
      <Metric label="Comments" value={compact(comments)} change="Across 8 posts" icon="bubble"/>
      <Metric label="Available views" value={compact(views)} change="Reels only" icon="eye"/>
      <Metric label="Saved posts" value={String(data.length)} change="Current dataset" icon="save"/>
    </div>
    <div className="overview-grid">
      <section className="card chart-card"><div className="card-head"><div><h2>Engagement over time</h2><p>Likes and comments by saved post</p></div><div className="legend"><span className="legend-likes"/>Likes <span className="legend-comments"/>Comments</div></div><EngagementChart data={data}/></section>
      <section className="card recent-card"><div className="card-head"><div><h2>Recent posts</h2><p>Latest saved content</p></div><button onClick={() => navigate("Top Posts")}>View all <Icon name="arrow"/></button></div>
        <div className="recent-list">{data.slice(0, 3).map(post => <div className="recent-item" key={post.id}><Art variant={post.art}/><div><strong>{post.caption}</strong><span>{post.date} · {post.type}</span></div><div className="recent-score"><strong>{compact(score(post))}</strong><span>score</span></div></div>)}</div>
      </section>
    </div>
  </>;
}

function Metric({ label, value, change, icon }: { label: string; value: string; change: string; icon: string }) {
  return <div className="metric-card"><div className={`metric-icon metric-${icon}`}>{icon === "heart" ? "♡" : icon === "bubble" ? "◌" : icon === "eye" ? "⊙" : "▱"}</div><span>{label}</span><strong>{value}</strong><small>{change}</small></div>;
}

function EngagementChart({ data }: { data: Post[] }) {
  const ordered = [...data].reverse();
  const max = Math.max(...ordered.map(score));
  return <div className="chart"><div className="chart-lines"><span/><span/><span/><span/></div><div className="bars">{ordered.map((post) => <div className="bar-group" key={post.id}><div className="bar-pair"><span className="bar-like" style={{ height: `${Math.max(10, (post.likes / max) * 100)}%` }}/><span className="bar-comment" style={{ height: `${Math.max(6, (post.comments * 2 / max) * 100)}%` }}/></div><small>{post.date.split(" ")[0]} {post.date.match(/\d+/)?.[0]}</small></div>)}</div></div>;
}

function TopPosts({ data }: { data: Post[] }) {
  const [filter, setFilter] = useState<"All" | PostType>("All");
  const [sort, setSort] = useState("engagement");
  const [pageSize, setPageSize] = useState(5);
  const [query, setQuery] = useState("");
  const shown = useMemo(() => data.filter(p => (filter === "All" || p.type === filter) && p.caption.toLowerCase().includes(query.toLowerCase())).sort((a, b) => {
    if (sort === "latest") return new Date(b.date).getTime() - new Date(a.date).getTime();
    if (sort === "likes") return b.likes - a.likes;
    if (sort === "comments") return b.comments - a.comments;
    if (sort === "views") return (b.views || -1) - (a.views || -1);
    return score(b) - score(a);
  }).slice(0, pageSize), [data, filter, sort, pageSize, query]);
  return <>
    <PageHeading kicker="Content library" title="Top posts" copy="Compare saved posts and reels using transparent performance metrics."/>
    <div className="toolbar">
      <div className="segmented">{(["All", "Post", "Reel"] as const).map(item => <button className={filter === item ? "selected" : ""} onClick={() => setFilter(item)} key={item}>{item === "All" ? "All content" : `${item}s`}</button>)}</div>
      <div className="toolbar-right">
        <label className="search-field"><Icon name="search"/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search captions"/></label>
        <label><span>Sort by</span><select value={sort} onChange={e => setSort(e.target.value)}><option value="engagement">Engagement</option><option value="likes">Likes</option><option value="comments">Comments</option><option value="views">Views</option><option value="latest">Latest date</option></select></label>
        <label><span>Show</span><select value={pageSize} onChange={e => setPageSize(Number(e.target.value))}><option>5</option><option>10</option><option>20</option></select></label>
      </div>
    </div>
    {!shown.length ? <EmptyState title="No matching posts" copy="Try another content filter or clear your caption search."/> :
    <div className="post-list">{shown.map((post, index) => <article className="post-card" key={post.id}>
      <span className="rank">#{index + 1}</span><Art variant={post.art} large/>
      <div className="post-info"><div className="post-meta"><span>{post.type}</span>{post.date}</div><h2>{post.caption}</h2><div className="tag-row">{post.tags.slice(0, 2).map(tag => <span key={tag}>#{tag}</span>)}</div>{post.link && <a href={post.link} target="_blank" rel="noreferrer">Open Instagram post <Icon name="external"/></a>}</div>
      <div className="post-stats"><div><span>Likes</span><strong>{full(post.likes)}</strong></div><div><span>Comments</span><strong>{full(post.comments)}</strong></div><div><span>Views</span><strong>{full(post.views)}</strong></div><div className="score-cell"><span>Engagement score</span><strong>{full(score(post))}</strong><small>Likes + (2 × comments)</small></div></div>
    </article>)}</div>}
  </>;
}

function Hashtags({ data }: { data: Post[] }) {
  const tags = useMemo(() => Object.entries(data.flatMap(post => post.tags).reduce<Record<string, number>>((acc, tag) => ({ ...acc, [tag]: (acc[tag] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]), [data]);
  const max = tags[0]?.[1] || 1;
  return <>
    <PageHeading kicker="Content patterns" title="Hashtags" copy="See which hashtags appear most often in the current saved-post dataset."/>
    <div className="info-note"><span>i</span><p><strong>About this data</strong> Counts reflect hashtags written in the captions of saved illustrative posts only. They do not represent live Instagram activity.</p></div>
    {!tags.length ? <EmptyState title="No hashtags to show" copy="Hashtag usage will appear after posts are available in the saved profile dataset."/> :
    <section className="card hashtag-card"><div className="card-head"><div><h2>Hashtag frequency</h2><p>{tags.length} unique hashtags across {data.length} saved posts</p></div></div>
      <div className="hashtag-list">{tags.map(([tag, count], index) => <div className="hashtag-row" key={tag}><span className="hash-rank">{String(index + 1).padStart(2, "0")}</span><strong>#{tag}</strong><div className="hash-bar"><span style={{ width: `${(count / max) * 100}%` }}/></div><b>{count}</b><small>{count === 1 ? "use" : "uses"}</small></div>)}</div>
    </section>}
  </>;
}

function classify(post: Post, data: Post[]) {
  const scores = data.map(score).sort((a, b) => a - b);
  const low = scores[Math.floor(scores.length / 3)] ?? 0;
  const high = scores[Math.floor(scores.length * 2 / 3)] ?? 0;
  return score(post) <= low ? "Low" : score(post) >= high ? "High" : "Medium";
}

function Analysis({ data }: { data: Post[] }) {
  const counts = ["Low", "Medium", "High"].map(label => ({ label, count: data.filter(post => classify(post, data) === label).length }));
  return <>
    <PageHeading kicker="Relative performance" title="Engagement analysis" copy="Understand how each post compares with other posts in this saved profile."/>
    <div className="analysis-note"><strong>How classification works</strong><p>Fuzzy labels compare engagement scores within the current saved-profile dataset. They describe existing illustrative data, not future performance or predictions.</p></div>
    <div className="class-grid">{counts.map(item => <div className={`class-card class-${item.label.toLowerCase()}`} key={item.label}><span>{item.label} engagement</span><strong>{item.count}</strong><small>{data.length ? `${Math.round(item.count / data.length * 100)}% of saved posts` : "No saved posts"}</small></div>)}</div>
    {!data.length ? <EmptyState title="Nothing to classify" copy="Classification needs at least one saved post in the illustrative dataset."/> :
    <div className="table-card"><div className="table-title"><h2>Post classification</h2><span>Score = Likes + (2 × Comments)</span></div><div className="table-scroll"><table><thead><tr><th>Post</th><th>Date & caption</th><th>Score</th><th>Classification</th></tr></thead><tbody>{[...data].sort((a,b) => score(b)-score(a)).map(post => <tr key={post.id}><td><Art variant={post.art}/></td><td><strong>{post.date}</strong><span>{post.caption}</span></td><td><strong>{full(score(post))}</strong></td><td><span className={`pill pill-${classify(post, data).toLowerCase()}`}>{classify(post, data)}</span></td></tr>)}</tbody></table></div></div>}
  </>;
}

function Recommendations({ data }: { data: Post[] }) {
  return <>
    <PageHeading kicker="Descriptive insights" title="Recommendations" copy="Practical observations grounded in patterns from the saved illustrative dataset."/>
    <div className="caution"><span>!</span><p><strong>Keep in mind</strong> These observations describe associations in a small sample. They do not prove causation or guarantee future results.</p></div>
    {!data.length ? <EmptyState title="Not enough data for observations" copy="Add saved posts to compare hashtag usage and media-type engagement."/> :
    <div className="recommend-grid">
      <section className="recommend-hero"><span className="mini-label">Key observation</span><h2>Reels lead on average engagement in this dataset.</h2><p>Saved reels average {full(Math.round(data.filter(p => p.type === "Reel").reduce((s,p) => s + score(p), 0) / data.filter(p => p.type === "Reel").length))} engagement score, compared with {full(Math.round(data.filter(p => p.type === "Post").reduce((s,p) => s + score(p), 0) / data.filter(p => p.type === "Post").length))} for posts.</p><div className="compare-bars"><div><span><b>Reels</b><em>Higher average</em></span><i className="reel-bar"/></div><div><span><b>Posts</b><em>Baseline average</em></span><i className="post-bar"/></div></div></section>
      <div className="recommend-stack">
        <article className="observation"><span className="obs-num">01</span><div><span className="mini-label">Hashtag pattern</span><h3>Review recurring creative-life tags</h3><p><strong>#creativelife</strong> appears most often. Compare the posts using it before deciding whether to keep it in future caption themes.</p></div></article>
        <article className="observation"><span className="obs-num">02</span><div><span className="mini-label">Content format</span><h3>Explore more process-led reels</h3><p>The top two reels show workspace or behind-the-scenes themes. Testing similar formats may provide a useful comparison.</p></div></article>
        <article className="observation"><span className="obs-num">03</span><div><span className="mini-label">Next step</span><h3>Use a larger sample before concluding</h3><p>Eight posts provide directional context only. Compare more saved posts across a longer date range.</p></div></article>
      </div>
    </div>}
  </>;
}

const suggestions = ["Which post performed best?", "Which posts are high engagement?", "What recommendations do you have?", "Which hashtags were used most often?"];

function Chatbot({ data }: { data: Post[] }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "bot"; text: string }[]>([{ role: "bot", text: "Hello, Alex. Ask me about the saved illustrative posts, engagement groups, or hashtag patterns." }]);
  function ask(value = question) {
    if (!value.trim()) return;
    let answer = "I don't have enough information in the saved prototype dataset to answer that honestly. Try asking about top posts, engagement groups, recommendations, or hashtag usage.";
    if (!data.length) answer = "There is not enough saved prototype data to answer this question. Analyze a sample profile with posts first.";
    else if (/best|performed/i.test(value)) { const best = [...data].sort((a,b) => score(b)-score(a))[0]; answer = `The best-performing saved post is “${best.caption}” with an engagement score of ${full(score(best))} (${full(best.likes)} likes and ${full(best.comments)} comments).`; }
    else if (/high engagement/i.test(value)) { const high = data.filter(p => classify(p, data) === "High"); answer = `${high.length} posts are classified as high engagement in this dataset: ${high.map(p => `“${p.caption}”`).join(" and ")}.`; }
    else if (/recommend/i.test(value)) answer = "Reels have a higher average engagement score in this small sample, and process-led reels are among the strongest posts. Consider testing similar formats, while remembering this pattern does not prove causation or guarantee results.";
    else if (/hashtag|used most/i.test(value)) answer = "#creativelife is used most often, appearing in 4 of the 8 saved posts. #desksetup appears 3 times; #productivity, #designinspo, and #visualdiary appear twice each.";
    setMessages(current => [...current, { role: "user", text: value }, { role: "bot", text: answer }]);
    setQuestion("");
  }
  return <>
    <PageHeading kicker="Dataset assistant" title="Ask your content" copy="Get straightforward answers drawn only from the saved illustrative dataset."/>
    <div className="chat-layout">
      <section className="chat-card">
        <div className="chat-head"><div className="bot-avatar"><Icon name="Chatbot"/></div><div><strong>PostPulse assistant</strong><span><i/> Ready · Prototype data only</span></div></div>
        <div className="messages">{messages.map((message, index) => <div className={`message message-${message.role}`} key={index}>{message.role === "bot" && <div className="bot-avatar small"><Icon name="Chatbot"/></div>}<p>{message.text}</p></div>)}</div>
        <form className="chat-input" onSubmit={event => { event.preventDefault(); ask(); }}><input value={question} onChange={event => setQuestion(event.target.value)} placeholder="Ask a question about your saved posts..." /><Button type="submit">Ask <Icon name="arrow"/></Button></form>
      </section>
      <aside className="suggestions"><span className="mini-label">Suggested questions</span><h2>Start a conversation</h2><p>Choose a prompt or type your own question.</p>{suggestions.map(item => <button key={item} onClick={() => ask(item)}><span>{item}</span><Icon name="arrow"/></button>)}<div className="honesty-note"><strong>Designed for honest answers</strong><p>If the data cannot support an answer, the assistant will say so.</p></div></aside>
    </div>
  </>;
}

export default function App() {
  const [started, setStarted] = useState(false);
  const [empty, setEmpty] = useState(false);
  return started ? <AppShell empty={empty} onHome={() => setStarted(false)} /> : <Home onComplete={(isEmpty) => { setEmpty(isEmpty); setStarted(true); }} />;
}
