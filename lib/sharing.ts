import type { Metadata } from "next";

export const SITE_TITLE = "العلم | المعرفة وراء الخبر";
export const SITE_DESCRIPTION = "منصة إعلام ومعرفة سعودية تشرح ما وراء الخبر عبر السلاسل والبيانات والفيديو والبودكاست.";
// نطاق النسخة الجديدة المتحقق منه؛ alelm.net ما زال يخدم الموقع السابق.
const DEPLOYED_ORIGIN = "https://elm-production-ea24.up.railway.app";

type SharingEnvironment = {
  [key: string]: string | undefined;
  SHARING_ORIGIN?: string;
  RAILWAY_PUBLIC_DOMAIN?: string;
  NEXT_PUBLIC_SITE_URL?: string;
};

/** أصول المشاركة تُخدم من النشر الفعلي؛ canonical يبقى مستقلًا أثناء النقل. */
export function sharingOrigin(env: SharingEnvironment = process.env): string {
  const railwayDomain = env.RAILWAY_PUBLIC_DOMAIN?.trim();
  const value = env.SHARING_ORIGIN || (railwayDomain && /^[a-z0-9-]+\.up\.railway\.app$/i.test(railwayDomain) ? `https://${railwayDomain}` : DEPLOYED_ORIGIN);
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Invalid public sharing origin");
  return url.origin;
}

type ShareInput = {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: "website" | "article";
  publishedTime?: string;
};

export function sharingMetadata(input: ShareInput, env: SharingEnvironment = process.env): Pick<Metadata, "openGraph" | "twitter"> {
  const origin = sharingOrigin(env);
  const fallback = { url: new URL("/og.png", origin).href, width: 1200, height: 630, type: "image/png", alt: SITE_TITLE };
  let image: { url: string; alt: string } | typeof fallback = fallback;
  if (input.image?.trim()) {
    try {
      const url = new URL(input.image, origin);
      if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password) image = { url: url.href, alt: input.title };
    } catch { /* رابط صورة غير صالح: نعرض بطاقة العلم. */ }
  }
  return {
    openGraph: {
      type: input.type ?? "website",
      locale: "ar_SA",
      siteName: "العلم",
      title: input.title,
      description: input.description,
      url: new URL(input.path, origin).href,
      images: [image],
      ...(input.type === "article" && input.publishedTime ? { publishedTime: input.publishedTime } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [{ url: image.url, alt: image.alt }],
    },
  };
}
