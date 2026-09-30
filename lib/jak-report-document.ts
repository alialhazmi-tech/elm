/** Raw report code is executable only inside an opaque-origin sandbox document.
 * Never inject it into an application page or use srcDoc (it inherits the app CSP).
 */
export const JAK_SANDBOX = "allow-scripts allow-popups allow-popups-to-escape-sandbox";

export function jakDocumentHeaders() {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Content-Security-Policy": [
      `sandbox ${JAK_SANDBOX}`,
      "default-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'self'",
      "frame-src 'none'",
      "object-src 'none'",
      "connect-src 'none'",
      "script-src 'unsafe-inline' https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/",
      "style-src 'unsafe-inline' https://fonts.googleapis.com",
      "font-src data: https://fonts.gstatic.com https://jakelelm.alelm.net",
      "img-src 'self' data: https://jakelelm.alelm.net https://dash.alelm.net https://alelm.net",
      "media-src 'self' https://jakelelm.alelm.net https://dash.alelm.net https://alelm.net",
    ].join("; "),
  };
}

const escapeText = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Keep stored source untouched. Combine the separate CSS field only at rendering. */
export function buildJakDocument({ html, css, title }: { html: string; css: string; title: string }): string {
  // The original FIFA source includes a placeholder style.css link although its
  // actual stylesheet is stored in the separate field. Do not request our API URL.
  const source = css.trim()
    ? html.replace(/<link\b(?=[^>]*\brel\s*=\s*["']stylesheet["'])(?=[^>]*\bhref\s*=\s*["'](?:\.\/)?style\.css["'])[^>]*>/gi, "")
    : html;
  const style = css.trim() ? `<style>${css.replace(/<\/style/gi, "<\\/style")}</style>` : "";
  const fallback = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeText(title)}</title>`;
  // Appended CSS respects a standalone document's own fonts, styles and scripts.
  if (/<head\b[^>]*>/i.test(source)) {
    return source.replace(/<head\b[^>]*>/i, (head) => `${head}${fallback}${style}`);
  }
  return `<!doctype html><html lang="ar" dir="rtl"><head>${fallback}${style}</head><body>${source}</body></html>`;
}
