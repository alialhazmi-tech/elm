import { PUBLIC_SITE_URL } from "./schema.ts";

export type PublicBreadcrumbItem = {
  label: string;
  href?: string;
};

export function breadcrumbStructuredData(items: readonly PublicBreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => {
      const listItem: Record<string, unknown> = {
        "@type": "ListItem",
        position: index + 1,
        name: item.label,
      };
      if (item.href) listItem.item = new URL(item.href, PUBLIC_SITE_URL).href;
      return listItem;
    }),
  };
}
