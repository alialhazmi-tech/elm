/** مصادر الصور العامة المعروفة فقط؛ لا يسمح المسار بتمرير عناوين حرة للخادم. */
export function publicImageSource(value: string, origin = "https://alelm.net"): { filename: string } | { url: string } | null {
  try {
    const url = new URL(value, origin);
    if (url.username || url.password || url.search || url.hash) return null;
    if (url.origin === origin) {
      const match = /^\/uploads\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp))$/i.exec(url.pathname);
      return match ? { filename: match[1] } : null;
    }
    const decoded = decodeURIComponent(url.pathname);
    if (decoded.includes("\\") || decoded.split("/").some((part) => part === ".." || part === ".")) return null;
    if (url.protocol === "https:" && !url.port && url.hostname === "dash.alelm.net" && url.pathname.startsWith("/wp-content/uploads/") && /\.(?:jpe?g|png|webp|gif|avif)$/i.test(url.pathname)) return { url: url.href };
  } catch { /* المصدر غير صالح. */ }
  return null;
}

export const IMAGE_WIDTHS = [168, 360, 640, 1080, 1600];

export function imageVariantSource(value: string) {
  return publicImageSource(value.startsWith("wp/") ? `https://dash.alelm.net/wp-content/uploads/${value.slice(3)}` : value);
}

export function imageVariantUrl(src: string, width: number): string {
  const source = publicImageSource(src);
  if (!source || /\.gif$/i.test(src)) return src;
  const value = "filename" in source ? `/uploads/${source.filename}` : `wp/${new URL(source.url).pathname.slice("/wp-content/uploads/".length)}`;
  // لا نكرر ترميز حروف العناوين العربية (%D8 → %25D8) في كل مرشح srcset.
  // نختصرها فقط إذا أعاد URL بناء العنوان نفسه، لحفظ أسماء الملفات التي تحتوي % حرفيًا.
  const readable = decodeURI(value);
  const compact = new URL(readable, "https://alelm.net").href === new URL(value, "https://alelm.net").href ? readable : value;
  const size = IMAGE_WIDTHS.find((size) => size >= width) ?? IMAGE_WIDTHS.at(-1)!;
  return `/image-variants?src=${encodeURIComponent(compact)}&w=${size}&v=1`;
}
