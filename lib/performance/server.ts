/** Only a fixed query family is logged: cache keys can contain private search text. */
export async function measureContentQuery<T>(key: string, load: () => Promise<T>): Promise<T> {
  const started = performance.now();
  let outcome = 'ok';
  try { return await load(); }
  catch (error) { outcome = 'error'; throw error; }
  finally {
    const durationMs = Math.round(performance.now() - started);
    if (durationMs >= 250 || outcome === 'error') {
      const prefix = key.split(':', 1)[0];
      const family = ['search', 'story', 'recent', 'home', 'related', 'page', 'series', 'news-strip'].includes(prefix) ? prefix : 'other';
      console.info(JSON.stringify({ event: 'content-performance', family, durationMs, outcome,
        cache: 'load', release: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 40) ?? 'local', at: Date.now() }));
    }
  }
}
