import type { Story } from "../content/types.ts";
import { articleMetaDescription, cleanMetadataText } from "./metadata.ts";

export const PUBLIC_SITE_URL = "https://alelm.net";
export const ORGANIZATION_ID = `${PUBLIC_SITE_URL}/#organization`;
export const WEBSITE_ID = `${PUBLIC_SITE_URL}/#website`;

const publisher = {
  "@type": "NewsMediaOrganization",
  "@id": ORGANIZATION_ID,
  name: "العلم",
  url: `${PUBLIC_SITE_URL}/`,
  logo: {
    "@type": "ImageObject",
    "@id": `${PUBLIC_SITE_URL}/#logo`,
    url: `${PUBLIC_SITE_URL}/brand/alelm-lockup.png`,
    width: 529,
    height: 240,
  },
};

function absoluteHttpImage(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(value, PUBLIC_SITE_URL);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** الهوية العامة للموقع؛ SearchAction غير مضاف لأنه ليس جزءًا من واجهة مؤكدة. */
export function siteStructuredData() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      publisher,
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        url: `${PUBLIC_SITE_URL}/`,
        name: "العلم",
        publisher: { "@id": ORGANIZATION_ID },
        inLanguage: "ar-SA",
      },
    ],
  };
}

type ArticleSchemaInput = {
  story: Pick<Story, "id" | "title" | "seoDescription" | "excerpt" | "body" | "keywords" | "publishedAt" | "updatedAt" | "image" | "section">;
  canonicalUrl: string;
  sectionName: string;
  includeEditorialTeam?: boolean;
};

/** NewsArticle schema المشترك للمادة العادية وقالب جاك العلم. */
export function articleStructuredData(input: ArticleSchemaInput) {
  const { story } = input;
  const description = articleMetaDescription(story);
  const articleId = `${input.canonicalUrl}#article`;
  const imageUrl = absoluteHttpImage(story.image);
  const publishedAt = story.publishedAt ? Date.parse(story.publishedAt) : NaN;
  const updatedAt = story.updatedAt ? Date.parse(story.updatedAt) : NaN;
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "@id": articleId,
    url: input.canonicalUrl,
    mainEntityOfPage: { "@type": "WebPage", "@id": input.canonicalUrl },
    headline: cleanMetadataText(story.title),
    description,
    keywords: story.keywords?.length ? story.keywords.join(", ") : undefined,
    datePublished: Number.isFinite(publishedAt) ? story.publishedAt : undefined,
    dateModified: Number.isFinite(publishedAt) && Number.isFinite(updatedAt) && updatedAt > publishedAt
      ? story.updatedAt
      : undefined,
    articleSection: input.sectionName,
    ...(imageUrl ? { image: [imageUrl] } : {}),
    publisher: { "@id": ORGANIZATION_ID },
    inLanguage: "ar-SA",
  };

  // لا نحول غياب الكاتـب إلى Person مجهول. هذا الاسم ظاهر فعلًا في المادة العادية.
  if (input.includeEditorialTeam) {
    schema.author = { "@type": "Organization", name: "فريق العلم" };
  }
  return schema;
}
