import { createServer } from 'node:http';

export const article = { id: 'fixture-1', title: 'خبر تجريبي عن العلوم', url: 'https://alelm.net/news/fixture-1',
  publisher: 'العلم', language: 'ar', bodyMarkdown: '# خبر تجريبي\n\nهذا محتوى اختباري محلي، وليس خبرًا منشورًا.',
  publishedAt: '2026-10-14T00:00:00.000Z' };
export async function fixtureServer() {
  const requests = [];
  const server = createServer((req, res) => {
    requests.push({ url: req.url, method: req.method, headers: req.headers });
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'GET' && req.url.startsWith('/api/content/v1/search?')) {
      res.end(JSON.stringify({ items: [article], total: 1, pageCount: 1, capped: false }));
    } else if (req.method === 'GET' && req.url === '/api/content/v1/articles/fixture-1') res.end(JSON.stringify(article));
    else { res.statusCode = 404; res.end(JSON.stringify({ error: 'not_found' })); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  return { url: `http://127.0.0.1:${server.address().port}`, requests,
    close: () => new Promise(done => { server.close(done); server.closeIdleConnections(); }) };
}
