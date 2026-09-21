/** No DB round-trip for telemetry. Bounded, process-local buckets; IPs never leave memory. */
export function createPerformanceLimiter() {
  const networks = new Map<string, { count: number; until: number }>();
  let total = 0, until = 0;
  return (key: string, now = Date.now()) => {
    if (now >= until) { total = 0; until = now + 60_000; networks.clear(); }
    if (++total > 300) return false;
    const bucket = networks.get(key) ?? { count: 0, until };
    bucket.count++;
    networks.set(key, bucket);
    return bucket.count <= 20;
  };
}
