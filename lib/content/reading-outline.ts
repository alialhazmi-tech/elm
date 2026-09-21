/** الإدخال HTML منقّى؛ نضيف معرفات عرض فقط ولا نخترع عناوين أو مصادر. */
export function readingOutline(html: string) {
  const headings: Array<{ id: string; title: string; level: number }> = [];
  const links: Array<{ href: string; label: string }> = [];
  const plain = (value: string) => value.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").trim();
  const body = html.replace(/<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi, (_, level, attrs, content) => {
    const title = plain(content);
    if (!title) return `<h${level}${attrs}>${content}</h${level}>`;
    const id = `read-section-${headings.length + 1}`;
    headings.push({ id, title, level: Number(level) });
    return `<h${level}${attrs} id="${id}">${content}</h${level}>`;
  });
  for (const match of html.matchAll(/<a href="(https?:\/\/[^"<>]*)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const url = new URL(match[1].replace(/&amp;/g, "&"));
      if (url.username || url.password || links.some(link => link.href === url.href)) continue;
      links.push({ href: url.href, label: plain(match[2]) || url.hostname });
    } catch { /* لا نعرض رابطًا غير قابل للقراءة. */ }
  }
  return { body, headings, links };
}
