import { createViewerStore } from "./viewer-store.ts";

/** جلسة القارئ أو الإدارة التي تحقّق منها الهيدر؛ تمنع بقاء نموذج الدخول بجانب حساب مسجّل. */
let authenticated = false;
const listeners = new Set<() => void>();
export const memberSessionStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  getSnapshot: () => authenticated,
  getServerSnapshot: () => false,
  update(value: boolean) {
    if (authenticated === value) return;
    authenticated = value;
    listeners.forEach((listener) => listener());
  },
};

export const viewerSessionStore = createViewerStore({
  onViewer: viewer => memberSessionStore.update(Boolean(viewer.member || viewer.editor)),
});

/** تغيّر الجلسة يبطل الطلب القديم قبل أن يعيد نشر هوية سابقة. */
export function invalidateViewerSession() {
  viewerSessionStore.invalidate();
  window.dispatchEvent(new Event("alelm:profile-updated"));
}

export async function refreshViewerAfter<T>(action: () => Promise<T>): Promise<T> {
  try { return await action(); }
  finally { invalidateViewerSession(); }
}
