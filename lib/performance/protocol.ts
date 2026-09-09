/** Never send URL queries, article slugs, keyword text, or account paths. */
const sections = new Set(['news', 'politics', 'economy', 'business', 'technology', 'sciences', 'health', 'sport', 'culture', 'world', 'varieties', 'infographics', 'videos', 'podcasts']);
const series = new Set(['absat', 'aghrab', 'efhamha-sah', 'bel-arqam', 'shakhsiat', 'limatha', 'matha-law', 'matha-baad', 'bel-tarikh']);
export function publicPerformanceRoute(pathname: string): string | null {
  const path = pathname.split(/[?#]/, 1)[0].replace(/\/$/, '') || '/';
  if (['/', '/search', '/series', '/about', '/contact', '/privacy-policy', '/jak'].includes(path)) return path;
  const parts = path.split('/').slice(1);
  if (parts[0] === 'keywords' && parts.length === 2 && parts[1]) return '/keywords/[keyword]';
  if (parts[0] === 'series' && parts.length === 2 && series.has(parts[1])) return path;
  if (!sections.has(parts[0])) return null;
  if (parts.length === 1) return path;
  if (parts.length >= 2 && parts.length <= 3 && /^(?:\d{1,12}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.test(parts[1])) return '/' + parts[0] + '/' + parts[1];
  return null;
}

export const SLOW_VALUES = { NAVIGATION: 1500, TTFB: 800, FCP: 1800, LCP: 2500, INP: 200, CLS: 0.1, RESOURCE: 1000 } as const;
export type MetricName = keyof typeof SLOW_VALUES;
export type PerformanceEvent = {
  name: MetricName;
  value: number;
  route: string;
  at: number;
  sample: 'random' | 'slow';
  navigationId: string;
  outcome?: 'complete' | 'superseded' | 'timeout' | 'hidden';
  networkMs?: number;
  ttfbMs?: number;
  resource?: 'image' | 'page';
};
const allowed = new Set(['name', 'value', 'route', 'at', 'sample', 'navigationId', 'outcome', 'networkMs', 'ttfbMs', 'resource']);
const bounded = (value: unknown, max = 120_000): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;

/** Strict allowlist on the server as well as the client; logs are untrusted observations. */
export function performanceInput(input: unknown, now = Date.now(), routeFor: (path: string) => string | null = publicPerformanceRoute): PerformanceEvent[] | null {
  if (!Array.isArray(input) || input.length < 1 || input.length > 8) return null;
  const result: PerformanceEvent[] = [];
  for (const item of input) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const v = item as Record<string, unknown>;
    if (Object.keys(v).some(key => !allowed.has(key))) return null;
    if (typeof v.name !== 'string' || !Object.hasOwn(SLOW_VALUES, v.name)) return null;
    const name = v.name as MetricName;
    if (!bounded(v.value, name === 'CLS' ? 100 : 120_000)) return null;
    if (typeof v.route !== 'string' || v.route !== routeFor(v.route)) return null;
    if (typeof v.at !== 'number' || !Number.isInteger(v.at) || Math.abs(now - v.at) > 86_400_000) return null;
    if (v.sample !== 'random' && !(v.sample === 'slow' && v.value >= SLOW_VALUES[name])) return null;
    if (typeof v.navigationId !== 'string' || !/^[a-f0-9-]{36}$/.test(v.navigationId)) return null;
    if (v.outcome !== undefined && (name !== 'NAVIGATION' || !['complete', 'superseded', 'timeout', 'hidden'].includes(String(v.outcome)))) return null;
    if (name === 'NAVIGATION' && v.outcome === undefined) return null;
    if (v.networkMs !== undefined && !bounded(v.networkMs)) return null;
    if (v.ttfbMs !== undefined && !bounded(v.ttfbMs)) return null;
    if (v.resource !== undefined && (name !== 'RESOURCE' || !['image', 'page'].includes(String(v.resource)))) return null;
    if (name === 'RESOURCE' && v.resource === undefined) return null;
    result.push(v as PerformanceEvent);
  }
  return result;
}

/** Dashboard telemetry carries page classes only, never IDs, search terms or account paths. */
export function dashboardPerformanceRoute(pathname: string): string | null {
  const path = pathname.split(/[?#]/, 1)[0].replace(/\/$/, "");
  if (["/tahrir", "/tahrir/tasks", "/tahrir/help", "/tahrir/stories", "/tahrir/media", "/tahrir/series", "/tahrir/schedule", "/tahrir/stats", "/tahrir/infographics", "/tahrir/ai-images", "/tahrir/ai-settings", "/tahrir/settings", "/tahrir/audit", "/tahrir/members", "/tahrir/admin-accounts", "/tahrir/roles"].includes(path)) return path;
  if (/^\/tahrir\/(editor|history|jak)\/[^/]+$/.test(path)) return `/tahrir/${path.split("/")[2]}/[id]`;
  return null;
}
