import { createNavigationTracker } from './navigation';
import { publicPerformanceRoute, SLOW_VALUES, type MetricName, type PerformanceEvent } from './protocol';

function createClient() {
  const initialRoute = publicPerformanceRoute(location.pathname);
  const documentId = crypto.randomUUID();
  const sampled = Math.random() < 0.1;
  let remaining = 40;
  const batch: PerformanceEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let navigationTimer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    clearTimeout(timer);
    timer = undefined;
    if (!batch.length) return;
    const body = JSON.stringify(batch.splice(0, 8));
    try {
      void fetch('/api/performance', { method: 'POST', body, headers: { 'Content-Type': 'application/json' },
        keepalive: true, credentials: 'omit', referrerPolicy: 'no-referrer' }).catch(() => {});
    } catch { /* Monitoring must never affect navigation. */ }
  };
  const report = (event: Omit<PerformanceEvent, 'sample'>) => {
    if (!remaining || !publicPerformanceRoute(location.pathname)) return;
    if (!Number.isFinite(event.value) || event.value < 0 || event.value > (event.name === 'CLS' ? 100 : 120_000)) return;
    if (!sampled && event.value < SLOW_VALUES[event.name]) return;
    remaining--;
    batch.push({ ...event, sample: sampled ? 'random' : 'slow' });
    if (batch.length >= 8) flush();
    else timer ??= setTimeout(flush, 2000);
  };
  const navigation = createNavigationTracker({
    now: () => performance.now(), wallTime: () => Date.now(), id: () => crypto.randomUUID(), report,
    network: (key, since) => {
      const matches = (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).filter(entry => {
        if (entry.startTime < since || entry.responseEnd <= 0) return false;
        const url = new URL(entry.name);
        if (url.origin !== location.origin) return false;
        url.searchParams.delete('_rsc');
        const target = new URL(key, location.origin);
        return url.pathname === target.pathname && url.searchParams.toString() === target.searchParams.toString();
      });
      const resource = matches.sort((a, b) => b.duration - a.duration)[0];
      return resource ? { networkMs: Math.round(resource.duration), ttfbMs: Math.round(Math.max(0, resource.responseStart - resource.requestStart)) } : {};
    },
  });
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { navigation.finish('hidden'); flush(); }
  });
  addEventListener('pagehide', () => { navigation.finish('hidden'); flush(); });
  if (typeof PerformanceObserver !== 'undefined') {
    try {
      const observer = new PerformanceObserver(list => {
        const route = publicPerformanceRoute(location.pathname);
        if (!route || document.visibilityState !== 'visible') return;
        for (const item of list.getEntries() as PerformanceResourceTiming[]) {
          if (item.duration < SLOW_VALUES.RESOURCE) continue;
          const url = new URL(item.name);
          if (url.origin !== location.origin) continue;
          const isImage = ['/image-variants', '/uploads/'].some(path => url.pathname.startsWith(path));
          const isPage = publicPerformanceRoute(url.pathname) && ['fetch', 'xmlhttprequest'].includes(item.initiatorType);
          if (!isImage && !isPage) continue;
          report({ name: 'RESOURCE', route, navigationId: documentId, at: Math.round(performance.timeOrigin + item.startTime),
            value: Math.round(item.duration), ttfbMs: Math.round(Math.max(0, item.responseStart - item.requestStart)), resource: isImage ? 'image' : 'page' });
        }
      });
      observer.observe({ type: 'resource', buffered: true });
    } catch { /* Resource timing is optional on older browsers. */ }
  }
  return {
    start(url: string) {
      clearTimeout(navigationTimer);
      if (document.visibilityState === 'visible' && navigation.start(url, location.href, location.origin)) {
        navigationTimer = setTimeout(() => navigation.finish('timeout'), 30_000);
      }
    },
    commit(pathname: string, search: string) {
      if (navigation.commit(pathname, search)) clearTimeout(navigationTimer);
    },
    vital(metric: { name: string; value: number }) {
      // Web Vitals are document-level metrics, attributed to the initial public route.
      if (!initialRoute || !Object.hasOwn(SLOW_VALUES, metric.name)) return;
      report({ name: metric.name as MetricName, value: metric.name === 'CLS' ? Math.round(metric.value * 1000) / 1000 : Math.round(metric.value),
        route: initialRoute, navigationId: documentId, at: Date.now() });
    },
  };
}

type Client = ReturnType<typeof createClient>;
const state = globalThis as typeof globalThis & { __alelmPerformance?: Client };
function client() {
  if (typeof window === 'undefined' || typeof crypto.randomUUID !== 'function') return;
  return state.__alelmPerformance ??= createClient();
}
export function startNavigation(url: string) { try { client()?.start(url); } catch { /* optional telemetry */ } }
export function commitNavigation(pathname: string, search: string) { try { client()?.commit(pathname, search); } catch { /* optional telemetry */ } }
export function reportWebVital(metric: { name: string; value: number }) { try { client()?.vital(metric); } catch { /* optional telemetry */ } }
export function initializePerformance() { try { client(); } catch { /* optional telemetry */ } }
