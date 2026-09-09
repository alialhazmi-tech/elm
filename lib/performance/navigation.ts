import { publicPerformanceRoute, type PerformanceEvent } from './protocol';

type Pending = { key: string; fromKey: string; route: string; started: number; at: number; id: string };
/** One active transition. Search strings are used for matching in memory only. */
export function createNavigationTracker(options: {
  routeFor?: (path: string) => string | null;
  now: () => number;
  wallTime: () => number;
  id: () => string;
  report: (event: Omit<PerformanceEvent, 'sample'>) => void;
  network: (key: string, since: number) => { networkMs?: number; ttfbMs?: number };
}) {
  const routeFor = options.routeFor ?? publicPerformanceRoute;
  let pending: Pending | undefined;
  const superseded = new Set<string>();
  const finish = (outcome: NonNullable<PerformanceEvent['outcome']>) => {
    if (!pending) return;
    const current = pending;
    pending = undefined;
    options.report({ name: 'NAVIGATION', route: current.route, navigationId: current.id,
      value: Math.round(Math.min(120_000, Math.max(0, options.now() - current.started))), at: current.at, outcome,
      ...(outcome === 'complete' ? options.network(current.key, current.started) : {}) });
  };
  return {
    start(target: string, from: string, origin: string) {
      if (!pending) superseded.clear();
      if (pending) superseded.add(pending.key);
      if (superseded.size > 8) superseded.delete(superseded.values().next().value!);
      finish('superseded');
      const url = new URL(target, origin);
      const previous = new URL(from, origin);
      if (url.origin !== origin || !routeFor(previous.pathname)) return false;
      const route = routeFor(url.pathname);
      const key = url.pathname + url.search;
      if (!route || key === previous.pathname + previous.search) return false;
      superseded.delete(key);
      pending = { key, fromKey: previous.pathname + previous.search, route, started: options.now(), at: options.wallTime(), id: options.id() };
      return true;
    },
    commit(pathname: string, search: string) {
      const key = pathname + (search ? '?' + search : '');
      if (!pending || key === pending.fromKey || superseded.has(key)) return false;
      // A committed redirect is also completion; never turn it into a false timeout.
      const route = routeFor(pathname);
      if (!route) { pending = undefined; return true; }
      pending.route = route;
      finish('complete');
      superseded.clear();
      return true;
    },
    finish,
  };
}
