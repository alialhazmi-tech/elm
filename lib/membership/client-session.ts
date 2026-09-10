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
