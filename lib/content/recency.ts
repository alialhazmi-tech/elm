/** ترتيب الظهور العام: النبض يتقدم، وإلا فتاريخ النشر الأصلي. */
export function publicRecencyIso(story: { boostedAt?: string | null; publishedAt?: string | null }): string {
  const boost = story.boostedAt?.trim();
  return boost || story.publishedAt || "";
}
