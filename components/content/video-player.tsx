import { instagramPostUrlFrom, videoEmbedUrl } from "@/lib/content/video";

/** مشغّل يوتيوب وX، وتضمين منشور إنستقرام الأصلي. */
export function VideoPlayer({ url, title }: { url: string; title: string }) {
  const embed = videoEmbedUrl(url);
  if (!embed) return null;
  const instagramUrl = instagramPostUrlFrom(url);

  if (!instagramUrl) {
    return <iframe src={embed} title={title} loading="lazy"
      allow="accelerometer; encrypted-media; picture-in-picture; web-share" allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin" className="aspect-video w-full rounded-md border-0 bg-black" />;
  }

  return (
    <div className="video-player-instagram mx-auto w-full max-w-[540px] overflow-hidden rounded-md bg-white">
      <iframe src={embed}
        title={title}
        loading="lazy"
        allow="autoplay; encrypted-media; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="block w-full border-0 bg-black"
        style={{ aspectRatio: "9 / 16", minHeight: "560px" }}
      />
      <a
        href={instagramUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block border-t border-slate-200 bg-white px-4 py-3 text-center text-sm font-medium text-slate-800 underline-offset-4 hover:underline"
      >
        فتح المنشور في إنستقرام
      </a>
    </div>
  );
}
