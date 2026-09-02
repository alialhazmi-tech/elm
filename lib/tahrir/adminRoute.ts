import { NextResponse } from "next/server";

import { AdminError } from "./admin";

/** يحوّل AdminError إلى استجابة بحالتها، ويعيد رمي ما عداها. */
export function adminErrorResponse(error: unknown): NextResponse {
  if (error instanceof AdminError) return NextResponse.json({ error: error.message }, { status: error.status });
  throw error;
}

export type IdContext = { params: Promise<{ id: string }> };
