import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q     = searchParams.get("q") ?? "";
  const sub   = searchParams.get("sub") ?? "";
  const sort  = searchParams.get("sort") ?? "relevance";
  const t     = searchParams.get("t") ?? "month";
  const limit = searchParams.get("limit") ?? "5";

  if (!q) {
    return NextResponse.json({ error: "Missing query param q" }, { status: 400 });
  }

  const base = sub
    ? `https://www.reddit.com/r/${sub}/search.json?restrict_sr=1`
    : `https://www.reddit.com/search.json?`;

  const url = `${base}&q=${encodeURIComponent(q)}&sort=${sort}&t=${t}&limit=${limit}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "InnoSuite/1.0 (prototype demo; contact: demo@innosuite.com)",
        "Accept": "application/json",
      },
      next: { revalidate: 300 }, // cache 5 minutes server-side
    });

    if (!res.ok) {
      throw new Error(`Reddit responded with HTTP ${res.status}`);
    }

    const json = await res.json();
    return NextResponse.json(json);
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 502 }
    );
  }
}
