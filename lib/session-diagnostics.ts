/** Fixed operation names and allowlisted metadata only: never serialize an auth/DB error. */
export type SessionOperation =
  | "member.cookie" | "member.session" | "member.refresh" | "member.profile"
  | "editor.session" | "editor.profile" | "editor.permissions";

const SAFE_CODES = new Set([
  "NETWORK_DNS", "NETWORK_REFUSED", "NETWORK_TIMEOUT", "NETWORK_RESET", "NETWORK_TLS", "NETWORK_ABORT", "NETWORK_ERROR",
  "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN",
  "53300", "57P01", "57P02", "57P03", "08001", "08006", "STORAGE_UNAVAILABLE",
]);

export class SessionReadError extends Error {
  readonly operation: SessionOperation;
  readonly status?: number;
  readonly code?: string;

  constructor(operation: SessionOperation, error: unknown) {
    super("Session dependency unavailable");
    this.name = "SessionReadError";
    this.operation = operation;
    // Drizzle wraps driver errors in cause. Only copy known codes/numeric HTTP
    // status, never its SQL, parameters, message, stack or connection URL.
    let current = error;
    for (let depth = 0; depth < 3 && current && typeof current === "object"; depth++) {
      const { status, code, cause } = current as { status?: unknown; code?: unknown; cause?: unknown };
      if (this.status === undefined && typeof status === "number" && Number.isInteger(status) && status >= 400 && status <= 599) this.status = status;
      if (this.code === undefined && typeof code === "string" && SAFE_CODES.has(code)) this.code = code;
      current = cause;
    }
  }
}

export async function sessionOperation<T>(operation: SessionOperation, read: () => Promise<T>): Promise<T> {
  try { return await read(); }
  catch (error) { throw error instanceof SessionReadError ? error : new SessionReadError(operation, error); }
}

export function logViewerFailure(error: unknown, requestId: string, dependency: "member" | "editor", durationMs: number) {
  console.error(JSON.stringify({
    event: "viewer-dependency-failure",
    requestId,
    dependency,
    operation: error instanceof SessionReadError ? error.operation : `${dependency}.unknown`,
    status: error instanceof SessionReadError ? error.status : undefined,
    code: error instanceof SessionReadError ? error.code : undefined,
    durationMs: Math.round(durationMs),
  }));
}
