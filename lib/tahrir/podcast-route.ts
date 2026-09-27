import { NextResponse } from "next/server";

import { PodcastError } from "./podcasts";

/** يحوّل PodcastError إلى استجابة بحالتها، ويعيد رمي ما عداها. */
export function podcastErrorResponse(error: unknown): NextResponse {
  if (error instanceof PodcastError) return NextResponse.json({ error: error.message }, { status: error.status });
  throw error;
}

export type PodcastIdContext = { params: Promise<{ id: string }> };
