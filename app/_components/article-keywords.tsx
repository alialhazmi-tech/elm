import Link from "next/link";
import { keywordHref, storyKeywords } from "@/lib/content/keywords";

export function ArticleKeywords({ keywords }: { keywords: unknown }) {
  const items = storyKeywords(keywords);
  if (!items.length) return null;
  return (
    <nav className="article-keywords" aria-label="الكلمات المفتاحية" dir="rtl">
      <h2>الكلمات المفتاحية</h2>
      <ul>
        {items.map((keyword) => <li key={keyword}><Link href={keywordHref(keyword)} rel="tag">{keyword}</Link></li>)}
      </ul>
    </nav>
  );
}
