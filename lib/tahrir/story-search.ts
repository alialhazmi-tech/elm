import { and, like, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { normalizeSearchText as normalizeStorySearch } from "../content/search-normalize.ts";
export { normalizeStorySearch };

export function storySearchTerms(query: string): string[] {
  return [...new Set(normalizeStorySearch(query.trim().slice(0, 80))
    .split(/[^\p{L}\p{N}%_\\]+/u).filter(Boolean))];
}

type SearchFields = { title: SQLWrapper; excerpt: SQLWrapper; keywords: SQLWrapper; body: SQLWrapper; editorSearchText: SQLWrapper };
const normalized = (field: SQLWrapper) => sql`alelm_editor_search_normalize(${field})`;
const pattern = (term: string) => `%${term.replace(/[\\%_]/g, char => `\\${char}`)}%`;
const allTerms = (field: SQL, terms: string[]) => and(...terms.map(term => like(field, pattern(term)))) ?? sql`false`;

/** النص مخزّن ومطبّع عند الحفظ؛ حتى البحث القصير لا يعيد معالجة كل المتون. */
export function storySearchWhere(fields: SearchFields, query: string): SQL {
  return allTerms(sql`${fields.editorSearchText}`, storySearchTerms(query));
}

/** تطابق العنوان أولًا ثم الموجز والكلمات المفتاحية ثم المتن؛ الزمن يفصل بين الدرجات المتساوية. */
export function storySearchRank(fields: SearchFields, query: string): SQL {
  const terms = storySearchTerms(query);
  const title = normalized(fields.title);
  const phrase = normalizeStorySearch(query.trim().slice(0, 80));
  const metadata = normalized(sql`${fields.title} || ' ' || ${fields.excerpt} || ' ' || coalesce(${fields.keywords}::text, '')`);
  return sql`case
    when ${title} = ${phrase} then 0
    when ${like(title, pattern(phrase))} then 1
    when ${allTerms(title, terms)} then 2
    when ${allTerms(metadata, terms)} then 3
    else 4 end`;
}
