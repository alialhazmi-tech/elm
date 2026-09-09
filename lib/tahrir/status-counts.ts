/**
 * كاش عدّادات الحالات داخل العملية (20 ثانية) — layout وكل صفحة تطلبها في كل تنقّل.
 * الحالة على globalThis لأن Next يحزم الصفحات ومسارات API في حزم منفصلة داخل العملية نفسها،
 * فالإبطال من مسار كتابة يجب أن يصل إلى قارئ الصفحات.
 */

export const STATUS_COUNTS_TTL_MS = 20_000;

type Counts = Record<string, number>;
interface CacheState {
  entry: { value: Counts; expiresAt: number } | null;
  inflight: Promise<Counts> | null;
  epoch: number;
}

const holder = globalThis as typeof globalThis & { __alelmStatusCounts?: CacheState };
const state = (): CacheState => (holder.__alelmStatusCounts ??= { entry: null, inflight: null, epoch: 0 });

export async function cachedStatusCounts(load: () => Promise<Counts>, now: () => number = Date.now): Promise<Counts> {
  const cache = state();
  if (cache.entry && cache.entry.expiresAt > now()) return cache.entry.value;
  if (cache.inflight) return cache.inflight;
  const epoch = cache.epoch;
  const pending = load()
    .then((value) => {
      // إبطال أثناء الاستعلام يعني أن النتيجة قد تكون قديمة؛ تُعاد للطالب ولا تُخزَّن.
      if (cache.epoch === epoch) cache.entry = { value, expiresAt: now() + STATUS_COUNTS_TTL_MS };
      return value;
    })
    .finally(() => { if (cache.inflight === pending) cache.inflight = null; });
  cache.inflight = pending;
  return pending;
}

/** يُستدعى بعد كل تغيير في حالة مادة أو إنشائها أو حذفها. */
export function invalidateStatusCounts() {
  const cache = state();
  cache.entry = null;
  cache.epoch += 1;
}
