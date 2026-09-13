export type ArticleState = {
  memberId: string | null; signedIn: boolean; saved: boolean;
  saveOwnerId: string | null; saveLoginHref: string | null;
  status: "loading" | "ready" | "error";
};
export const EMPTY_ARTICLE_STATE: ArticleState = Object.freeze({
  memberId: null, signedIn: false, saved: false, saveOwnerId: null, saveLoginHref: null, status: "loading",
});
type StateUpdate = ArticleState | ((current: ArticleState) => ArticleState);

/** مخزن لكل مادة في التبويب فقط. لا تخزين دائم لبيانات العضو أو إعادة استخدام بعد مغادرة المادة. */
export function createArticleStateStore(load: (signal: AbortSignal) => Promise<ArticleState | null>) {
  let state = EMPTY_ARTICLE_STATE;
  let controller: AbortController | undefined;
  let pending: Promise<ArticleState | null> | undefined;
  let generation = 0;
  const listeners = new Set<() => void>();
  const emit = () => { for (const listener of listeners) listener(); };
  const setState = (update: StateUpdate) => {
    state = typeof update === "function" ? update(state) : update;
    emit();
  };
  const refresh = (invalidate = false): Promise<ArticleState | null> => {
    if (pending && !invalidate) return pending;
    controller?.abort();
    const request = ++generation;
    controller = new AbortController();
    // لا نعرض صلاحيات أو محفوظات الحساب السابق أثناء إعادة التحقق.
    setState(EMPTY_ARTICLE_STATE);
    const signal = controller.signal;
    pending = Promise.resolve().then(() => load(signal)).catch(() => null).then(data => {
      if (request !== generation) return null;
      pending = undefined;
      setState(data ?? { ...EMPTY_ARTICLE_STATE, status: "error" });
      return data;
    });
    return pending;
  };
  return {
    getSnapshot: () => state,
    setState,
    refresh,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    dispose() { generation++; controller?.abort(); pending = undefined; state = EMPTY_ARTICLE_STATE; },
  };
}
