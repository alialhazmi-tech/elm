import Link from "next/link";
import type { PublicBreadcrumbItem } from "@/lib/seo/breadcrumbs";
import { breadcrumbStructuredData } from "@/lib/seo/breadcrumbs";
import "./public-breadcrumbs.css";

type PublicBreadcrumbsProps = {
  items: readonly PublicBreadcrumbItem[];
};

export function PublicBreadcrumbs({ items }: PublicBreadcrumbsProps) {
  const lastIndex = items.length - 1;
  return (
    <nav className="public-breadcrumbs" aria-label="مسار التصفح" dir="rtl">
      <ol>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            {item.href && index !== lastIndex ? (
              <Link href={item.href}>{item.label}</Link>
            ) : (
              <span aria-current={index === lastIndex ? "page" : undefined}>{item.label}</span>
            )}
          </li>
        ))}
      </ol>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbStructuredData(items)).replace(/</g, "\\u003c"),
        }}
      />
    </nav>
  );
}
