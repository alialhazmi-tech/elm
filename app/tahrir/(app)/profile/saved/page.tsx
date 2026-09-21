import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { memberSavedStories, stories } from "@/db/schema";
import { getDb } from "@/lib/db";
import { loadActor } from "@/lib/tahrir/access";
import { editorSavedOwner } from "@/lib/personalization/saved-viewer";
import { SavedStoriesList } from "@/components/tahrir/saved-stories-list";

export const metadata = { title: "المواد المحفوظة" };
export const dynamic = "force-dynamic";
export default async function SavedPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const actor = await loadActor();
  if (!actor) redirect("/tahrir/login");
  if (actor.mustChangePassword) redirect("/tahrir/password");
  const db = getDb();
  if (!db) throw new Error("SAVED_UNAVAILABLE");
  const params = await searchParams;
  const page = Math.max(1, Math.min(5000, Math.floor(Number(params.page)) || 1));
  const ownerId = editorSavedOwner(actor.userId);
  const rows = await db.select({ id: stories.id, title: stories.title, section: stories.section, slug: stories.slug })
    .from(memberSavedStories).innerJoin(stories, and(eq(stories.id, memberSavedStories.storyId), eq(stories.status, "published")))
    .where(eq(memberSavedStories.memberId, ownerId)).orderBy(desc(memberSavedStories.createdAt), desc(memberSavedStories.storyId)).limit(21).offset((page - 1) * 20);
  return <main className="mx-auto flex w-full max-w-4xl flex-col gap-6">
    <div><h1 className="font-display text-2xl font-extrabold">المواد المحفوظة</h1><p className="mt-2 text-sm text-muted-foreground">المواد التي حفظتها بحسابك الإداري للعودة إليها لاحقًا.</p></div>
    {rows.length ? <SavedStoriesList ownerId={ownerId} items={rows.slice(0, 20).map(row => ({ id: row.id, title: row.title, href: `/${row.section}/${row.id}/${row.slug}` }))} /> : <p className="rounded-xl border bg-card p-6">{page === 1 ? "لا توجد مواد محفوظة بعد. استخدم زر «احفظ المادة» أثناء التصفح." : "لا توجد مواد في هذه الصفحة."}</p>}
    <nav aria-label="صفحات المحفوظات" className="flex justify-between gap-4 text-sm">
      {page > 1 && <Link href={`/tahrir/profile/saved?page=${page - 1}`}>الصفحة السابقة</Link>}
      {rows.length > 20 && <Link href={`/tahrir/profile/saved?page=${page + 1}`}>الصفحة التالية</Link>}
    </nav>
    <Link href="/tahrir/profile" className="text-sm hover:underline">العودة إلى ملفي الشخصي</Link>
  </main>;
}
