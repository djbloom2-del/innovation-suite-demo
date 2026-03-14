import { NextRequest, NextResponse } from "next/server";
import { getSocialPosts } from "@/data/social";

// Returns synthetic but realistic CPG consumer discussion posts in the same
// shape that RedditFeed.tsx already parses: { data: { children: [{ data: ... }] } }
//
// Future upgrade: replace getSocialPosts() with a call to the Reddit OAuth API
// or a social listening platform (Brandwatch, Talkwalker, etc.) — no UI changes needed.

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q     = searchParams.get("q") ?? "";
  const limit = parseInt(searchParams.get("limit") ?? "5", 10);

  if (!q) {
    return NextResponse.json({ error: "Missing query param q" }, { status: 400 });
  }

  const posts = getSocialPosts(q, Math.min(limit, 20));

  return NextResponse.json({
    data: {
      children: posts.map((p) => ({ data: p })),
    },
  });
}
