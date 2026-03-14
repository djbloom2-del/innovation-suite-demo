"use client";

import { useEffect, useState, useRef } from "react";
import { ExternalLink, AlertTriangle, MessageSquare } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface RedditPost {
  title: string;
  subreddit: string;
  score: number;
  upvote_ratio: number;
  num_comments: number;
  created_utc: number;
  permalink: string;
}

interface Props {
  query: string;
  subreddit?: string;
  sort?: "relevance" | "top" | "new";
  timePeriod?: "week" | "month" | "year";
  limit?: number;
  emptyMessage?: string;
}

// ── Session-level cache (survives re-renders, cleared on page refresh) ────────

const postCache = new Map<string, RedditPost[]>();

// ── Helpers ──────────────────────────────────────────────────────────────────

function cacheKey(query: string, sub: string, sort: string, t: string, limit: number) {
  return `${query}|${sub}|${sort}|${t}|${limit}`;
}

function timeAgo(utc: number): string {
  const secs = Math.floor(Date.now() / 1000) - utc;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function sentimentColor(ratio: number): string {
  if (ratio >= 0.85) return "#16a34a"; // green
  if (ratio >= 0.65) return "#d97706"; // amber
  return "#ef4444"; // red
}

function sentimentLabel(ratio: number): string {
  if (ratio >= 0.85) return "Positive";
  if (ratio >= 0.65) return "Mixed";
  return "Negative";
}

/** 5 filled dots representing upvote ratio */
function SentimentDots({ ratio }: { ratio: number }) {
  const color = sentimentColor(ratio);
  const filled = Math.round(ratio * 5);
  return (
    <span className="flex items-center gap-0.5" title={`${sentimentLabel(ratio)} (${Math.round(ratio * 100)}% upvoted)`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: i < filled ? color : "#e2e8f0" }}
        />
      ))}
    </span>
  );
}

// ── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="animate-pulse space-y-1.5 py-3 border-b border-slate-50">
      <div className="h-3 bg-slate-100 rounded w-16" />
      <div className="h-3.5 bg-slate-100 rounded w-full" />
      <div className="h-3 bg-slate-100 rounded w-32" />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function RedditFeed({
  query,
  subreddit = "",
  sort = "relevance",
  timePeriod = "month",
  limit = 5,
  emptyMessage = "No recent discussions found for this topic.",
}: Props) {
  const [posts, setPosts] = useState<RedditPost[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!query) return;

    const key = cacheKey(query, subreddit, sort, timePeriod, limit);

    // Return cached results immediately
    if (postCache.has(key)) {
      setPosts(postCache.get(key)!);
      return;
    }

    // Abort any in-flight request
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);
    setPosts(null);

    const params = new URLSearchParams({ q: query, sort, t: timePeriod, limit: String(limit) });
    if (subreddit) params.set("sub", subreddit);

    fetch(`/api/reddit?${params.toString()}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        const items: RedditPost[] = (data?.data?.children ?? []).map(
          (child: { data: RedditPost }) => child.data
        );
        postCache.set(key, items);
        setPosts(items);
        setFetchedAt(new Date());
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError("Couldn't load live Reddit data — the API may be temporarily unavailable.");
        setLoading(false);
      });

    return () => ctrl.abort();
  }, [query, subreddit, sort, timePeriod, limit]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div>
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
        <span>{error}</span>
      </div>
    );
  }

  if (posts !== null && posts.length === 0) {
    return (
      <p className="text-xs text-slate-400 italic py-3">{emptyMessage}</p>
    );
  }

  if (!posts) return null;

  const subredditForLink = subreddit || "all";

  return (
    <div>
      {/* Post list */}
      <div className="divide-y divide-slate-50">
        {posts.map((post, i) => (
          <div key={i} className="py-3 hover:bg-slate-50 -mx-1 px-1 rounded transition-colors">
            {/* Meta row */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                r/{post.subreddit}
              </span>
              <SentimentDots ratio={post.upvote_ratio} />
              <span className="text-[10px] text-slate-400 tabular-nums">
                +{post.score.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-300">·</span>
              <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                <MessageSquare size={9} />
                {post.num_comments}
              </span>
              <span className="text-[10px] text-slate-300">·</span>
              <span className="text-[10px] text-slate-400">{timeAgo(post.created_utc)}</span>
            </div>
            {/* Title */}
            <a
              href={`https://www.reddit.com${post.permalink}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-700 hover:text-blue-600 leading-snug line-clamp-2 transition-colors flex items-start gap-1"
            >
              <span className="flex-1">{post.title}</span>
              <ExternalLink size={10} className="shrink-0 mt-0.5 text-slate-300" />
            </a>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-50 pt-2">
        <span>
          Live from Reddit
          {fetchedAt && (
            <span className="ml-1">· Updated {fetchedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          )}
        </span>
        <a
          href={`https://www.reddit.com/r/${subredditForLink}/search/?q=${encodeURIComponent(query)}&sort=${sort}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:text-blue-700 flex items-center gap-0.5 transition-colors"
        >
          View more on Reddit <ExternalLink size={9} />
        </a>
      </div>
    </div>
  );
}
