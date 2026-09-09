import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, desc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { stories } from "@/db/schema";
import { loadActor, canEditStory } from "@/lib/tahrir/access";
import { workflowDb } from "@/lib/tahrir/workflow";
import { StatusPill } from "@/components/tahrir/badges";
export const metadata = { title: "مهامي" };
export default async function TasksPage({ searchParams }: { searchParams: Promise<{ filter?: string; page?: string }> }) {
  const actor = await loadActor(); if (!actor) redirect("/tahrir/login");
  const query = await searchParams;
  const filter = ["assigned", "returned", "own"].includes(query.filter ?? "") ? query.filter! : "all";
  const page = Math.min(1000, Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1));
  const mine = or(eq(stories.authorId, actor.userId), eq(stories.assignedTo, actor.userId));
  const rows = await workflowDb().select({ id: stories.id, title: stories.title, status: stories.status, assignedTo: stories.assignedTo, authorId: stories.authorId, dueAt: stories.dueAt, returnedAt: stories.returnedAt, revisionOf: stories.revisionOf, overdue: sql<boolean>`coalesce(${stories.dueAt}::timestamptz < now(), false)` }).from(stories).where(and(mine,
    inArray(stories.status, ["draft", "review", "scheduled"]),
    filter === "assigned" ? eq(stories.assignedTo, actor.userId) : filter === "own" ? eq(stories.authorId, actor.userId) : filter === "returned" ? isNotNull(stories.returnedAt) : undefined,
  )).orderBy(sql`${stories.dueAt} asc nulls last`, desc(stories.updatedAt), asc(stories.id)).limit(31).offset((page - 1) * 30);
  const labels: Record<string, string> = { draft: "مسودة", review: "بانتظار الاعتماد", scheduled: "مجدولة" };
  return <main className="space-y-5"><div><h1 className="font-display text-2xl font-bold">مهامي</h1><p className="mt-2 text-sm text-muted-foreground">موادك قيد العمل والمواد المسندة إليك، مرتبة حسب أقرب موعد تسليم.</p></div>
    <nav aria-label="تصفية المهام" className="flex flex-wrap gap-2">{[["all", "كل مهامي"], ["assigned", "مسندة إليّ"], ["returned", "أُعيدت للتعديل"], ["own", "موادي"]].map(([key, label]) => <Link key={key} href={`/tahrir/tasks?filter=${key}`} aria-current={filter === key ? "page" : undefined} className={`rounded-lg border px-3 py-2 text-sm ${filter === key ? "bg-primary text-primary-foreground" : "bg-card"}`}>{label}</Link>)}</nav>
    {!rows.length ? <div className="rounded-xl border bg-card p-8 text-center"><p>لا توجد مهام في هذه القائمة.</p>{actor.can("story.create") && <Link href="/tahrir/editor/new" className="mt-3 inline-block underline">إنشاء مادة جديدة</Link>}</div> : <ul className="divide-y rounded-xl border bg-card">{rows.slice(0, 30).map(story => <li key={story.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="min-w-0"><Link href={canEditStory(actor, story) ? `/tahrir/editor/${story.id}` : "/tahrir/stories"} className="font-semibold hover:underline">{story.title || "مسودة بلا عنوان"}</Link><div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">{story.revisionOf && <span>مسودة تعديل</span>}{story.assignedTo === actor.userId && <span>مسندة إليك</span>}{story.returnedAt && <span className="text-amber-700 dark:text-amber-300">أُعيدت للتعديل — راجع ملاحظات المادة</span>}{story.dueAt && <time dateTime={story.dueAt} className={story.overdue ? "text-destructive" : ""}>التسليم: {new Date(story.dueAt).toLocaleString("ar-SA-u-ca-gregory-nu-latn", { timeZone: "Asia/Riyadh", dateStyle: "medium", timeStyle: "short" })} (الرياض){story.overdue ? " · متأخرة" : ""}</time>}</div></div><StatusPill status={story.status} label={labels[story.status]} /></li>)}</ul>}
    <div className="flex gap-4 text-sm">{page > 1 && <Link href={`/tahrir/tasks?filter=${filter}&page=${page - 1}`}>السابق</Link>}{rows.length > 30 && <Link href={`/tahrir/tasks?filter=${filter}&page=${page + 1}`}>التالي</Link>}</div>
  </main>;
}
