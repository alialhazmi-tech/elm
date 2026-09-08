import { HOSTED_PODCAST_AUDIO } from "./podcasts.ts";

type OpenAudio = (key: string, range: string | undefined, signal: AbortSignal) => Promise<ReadableStream>;

/** بث مجزأ من المخزن؛ لا تُحمّل الحلقة كاملة في ذاكرة خادم Next. */
export async function servePodcastAudio(request: Request, filename: string, openAudio: OpenAudio): Promise<Response> {
  const audio = HOSTED_PODCAST_AUDIO.find((item) => item.filename === filename);
  if (!audio) return new Response(null, { status: 404 });
  const size = audio.byteLength;
  const etag = `"${audio.sha256}"`;
  const headers = new Headers({
    "Content-Type": "audio/mp4",
    "Content-Length": String(size),
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    ETag: etag,
  });
  if (request.headers.get("if-none-match")?.split(",").some((value) =>
    value.trim().replace(/^W\//, "") === etag || value.trim() === "*")) {
    headers.delete("Content-Length");
    return new Response(null, { status: 304, headers });
  }
  // HEAD ignores Range, per HTTP semantics.
  if (request.method === "HEAD") return new Response(null, { headers });
  const ifRange = request.headers.get("if-range");
  const rawRange = !ifRange || ifRange === etag ? request.headers.get("range") : null;
  let range: string | undefined;
  if (rawRange) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rawRange);
    let start = 0;
    let end = size - 1;
    let valid = Boolean(match && (match[1] || match[2]));
    if (match && valid) {
      if (!match[1]) {
        const suffix = Number(match[2]);
        valid = Number.isSafeInteger(suffix) && suffix > 0;
        start = Math.max(0, size - suffix);
      } else {
        start = Number(match[1]);
        const requestedEnd = match[2] ? Number(match[2]) : end;
        valid = Number.isSafeInteger(start) && Number.isSafeInteger(requestedEnd)
          && start < size && start <= requestedEnd;
        end = Math.min(end, requestedEnd);
      }
    }
    if (!valid) return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${size}`, "Cache-Control": "no-store" },
    });
    range = `bytes=${start}-${end}`;
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
  }
  try {
    const stream = await openAudio(`podcasts/alghabouq/${audio.filename}`, range, request.signal);
    return new Response(stream, { status: range ? 206 : 200, headers });
  } catch {
    return new Response(null, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
