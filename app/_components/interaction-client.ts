export const INTERACTION_EVENT = "alelm-interaction-change";
export type InteractionState = { liked: boolean; closingAnswer: number | null; counts: number[] };

// Share the initial request with the poll, like button and reading tracker so
// the first page load establishes one browser cookie before any writes.
const pending = new Map<string, Promise<InteractionState>>();
export function invalidateArticleInteraction(storyId: string) { pending.delete(storyId); }
export function loadArticleInteraction(storyId: string): Promise<InteractionState> {
  const existing = pending.get(storyId);
  if (existing) return existing;
  const task = fetch(`/api/content/interactions?storyId=${encodeURIComponent(storyId)}`, { cache: "no-store" })
    .then(async response => {
      if (!response.ok) throw new Error("UNAVAILABLE");
      return response.json() as Promise<InteractionState>;
    }).finally(() => { if (pending.get(storyId) === task) pending.delete(storyId); });
  pending.set(storyId, task);
  return task;
}
