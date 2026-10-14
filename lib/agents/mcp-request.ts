export class McpRequestError extends Error {
  status: number;
  code: number;
  constructor(message: string, status: number, code = -32600) {
    super(message); this.status = status; this.code = code;
  }
}

/** Bound streamed bodies too; Content-Length alone is not a trustworthy limit. */
export async function readMcpRequest(request: Request, timeoutMs = 10_000): Promise<unknown> {
  const max = 16_384;
  if (Number(request.headers.get("content-length")) > max) throw new McpRequestError("Request body too large", 413);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new McpRequestError("Content-Type must be application/json", 415);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new McpRequestError("JSON request body required", 400, -32700);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new McpRequestError("Request body timed out", 408)), timeoutMs);
  });
  try {
    const chunks: Uint8Array[] = []; let length = 0;
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      length += value.byteLength;
      if (length > max) throw new McpRequestError("Request body too large", 413);
      chunks.push(value);
    }
    let parsed: unknown;
    try { parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { throw new McpRequestError("Invalid JSON", 400, -32700); }
    if (Array.isArray(parsed)) throw new McpRequestError("Batch requests are not supported", 400);
    return parsed;
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
  }
}
