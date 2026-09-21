"use client";

import { useCallback, useSyncExternalStore } from "react";
import { createArticleStateStore, EMPTY_ARTICLE_STATE, type ArticleState } from "@/lib/personalization/article-state-store";

const stores = new Map<string, ReturnType<typeof createEntry>>();
function createEntry(storyId: string) {
  const store = createArticleStateStore(async signal => {
    const response = await fetch(`/api/me/article-state?storyId=${encodeURIComponent(storyId)}`, {
      credentials: "same-origin", cache: "no-store", signal,
    });
    if (!response.ok) return null;
    const data = await response.json();
    return {
      memberId: typeof data.memberId === "string" ? data.memberId : null, signedIn: Boolean(data.signedIn), saved: Boolean(data.saved),
      saveOwnerId: typeof data.saveOwnerId === "string" ? data.saveOwnerId : null,
      saveLoginHref: typeof data.saveLoginHref === "string" ? data.saveLoginHref : null, status: "ready",
    } satisfies ArticleState;
  });
  let subscribers = 0;
  const refresh = () => { void store.refresh(true); };
  const visible = () => { if (document.visibilityState === "visible") refresh(); };
  return {
    ...store,
    subscribe(listener: () => void) {
      const remove = store.subscribe(listener);
      if (++subscribers === 1) {
        window.addEventListener("focus", refresh);
        window.addEventListener("alelm-saved-change", refresh);
        document.addEventListener("visibilitychange", visible);
        void store.refresh();
      }
      return () => {
        remove();
        if (--subscribers === 0) {
          window.removeEventListener("focus", refresh);
          window.removeEventListener("alelm-saved-change", refresh);
          document.removeEventListener("visibilitychange", visible);
          queueMicrotask(() => {
            if (!subscribers) { store.dispose(); stores.delete(storyId); }
          });
        }
      };
    },
  };
}
const serverSnapshot = () => EMPTY_ARTICLE_STATE;
function entry(storyId: string) {
  let value = stores.get(storyId);
  if (!value) { value = createEntry(storyId); stores.set(storyId, value); }
  return value;
}
export function useArticleState(storyId: string) {
  const subscribe = useCallback((listener: () => void) => entry(storyId).subscribe(listener), [storyId]);
  const snapshot = useCallback(() => entry(storyId).getSnapshot(), [storyId]);
  const state = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const setState = useCallback((update: Parameters<ReturnType<typeof createArticleStateStore>["setState"]>[0]) => entry(storyId).setState(update), [storyId]);
  const refresh = useCallback(() => entry(storyId).refresh(true), [storyId]);
  return [state, setState, refresh] as const;
}
