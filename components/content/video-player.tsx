import { videoEmbedUrl } from "@/lib/content/video";

/** مصدران للفيديو وحده؛ تضمين التغريدة الكاملة مستقل داخل المتن. */
export function VideoPlayer({ url, title }: { url: string; title: string }) {
  const embed = videoEmbedUrl(url);
  if (!embed) return null;
  return <iframe src={embed} title={title} loading="lazy"
    allow="accelerometer; encrypted-media; picture-in-picture; web-share" allowFullScreen
    referrerPolicy="strict-origin-when-cross-origin" className="aspect-video w-full rounded-md border-0 bg-black" />;
}
