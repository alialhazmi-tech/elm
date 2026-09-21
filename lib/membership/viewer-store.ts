export type ViewerIdentity = { name: string; image?: string | null };
export type MemberIdentity = ViewerIdentity & { emailVerified: boolean };
export type Viewer = { member: MemberIdentity | null; editor: ViewerIdentity | null };
type Snapshot = { viewer: Viewer | null; error: boolean };
const INITIAL: Snapshot = { viewer: null, error: false };
const FRESH_MS = 60_000;

function isIdentity(value: unknown): value is ViewerIdentity {
  if (!value || typeof value !== "object") return false;
  const identity = value as Record<string, unknown>;
  return typeof identity.name === "string" &&
    (identity.image == null || typeof identity.image === "string");
}
function isViewer(value: unknown): value is Viewer {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return (data.member === null || (isIdentity(data.member) &&
    typeof (data.member as MemberIdentity).emailVerified === "boolean")) &&
    (data.editor === null || isIdentity(data.editor));
}

/** ذاكرة عرض داخل التبويب فقط؛ صلاحيات الحساب تبقى متحققة على الخادم. */
export function createViewerStore({
  fetcher = (signal: AbortSignal) => fetch("/api/viewer", {
    credentials: "same-origin", cache: "no-store", signal,
  }),
  now = Date.now,
  onViewer,
}: {
  fetcher?: (signal: AbortSignal) => Promise<Response>;
  now?: () => number;
  onViewer?: (viewer: Viewer) => void;
} = {}) {
  let snapshot = INITIAL;
  let checkedAt = -Infinity;
  let generation = 0;
  let pending: Promise<void> | undefined;
  let controller: AbortController | undefined;
  const listeners = new Set<() => void>();
  const publish = (next: Snapshot) => {
    snapshot = next;
    if (next.viewer) onViewer?.(next.viewer);
    listeners.forEach(listener => listener());
  };
  const cancel = () => {
    generation++;
    controller?.abort();
    pending = undefined;
  };
  const refresh = (force = false): Promise<void> => {
    if (pending && !force) return pending;
    if (!force && now() - checkedAt < (snapshot.error ? 5_000 : FRESH_MS)) return Promise.resolve();
    if (force) cancel();
    const requestGeneration = generation;
    const request = new AbortController();
    controller = request;
    const timeout = setTimeout(() => request.abort(), 10_000);
    pending = (async () => {
      try {
        const response = await fetcher(request.signal);
        if (!response.ok) throw new Error("Viewer unavailable");
        const viewer: unknown = await response.json();
        if (!isViewer(viewer)) throw new Error("Invalid viewer response");
        if (requestGeneration !== generation) return;
        checkedAt = now();
        publish({ viewer, error: false });
      } catch {
        if (requestGeneration !== generation) return;
        checkedAt = now();
        publish({ viewer: snapshot.viewer, error: true });
      } finally {
        clearTimeout(timeout);
        if (requestGeneration === generation) pending = undefined;
      }
    })();
    return pending;
  };
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => INITIAL,
    refresh,
    invalidate() {
      cancel();
      checkedAt = -Infinity;
    },
    removeIdentity(kind: "member" | "editor") {
      cancel();
      checkedAt = now();
      if (snapshot.viewer) publish({ viewer: { ...snapshot.viewer, [kind]: null }, error: false });
    },
  };
}
