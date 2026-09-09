import { eq, sql, getTableColumns } from "drizzle-orm";
import { stories, storyVersions } from "@/db/schema";
import { getDb } from "@/lib/db";
import { assertCanWrite, assertExpectedVersion, StoryWriteError, type WriteActor } from "./write-policy";
import { invalidateStatusCounts } from "./status-counts";
import { fieldChanges, type StoryAuditOptions } from "./story-audit";

export type WorkflowStory = typeof stories.$inferSelect;
export function workflowDb() {
  const db = getDb();
  if (!db) throw new Error("قاعدة البيانات غير مهيأة.");
  return db;
}

/** القفل والتحقق في المعاملة نفسها: يحمي كل الكتابات التالية في batch. */
export function lockStory(story: Pick<WorkflowStory, "id" | "version" | "status">) {
  return workflowDb().execute(sql`select alelm_assert_story_version(${story.id}, ${story.version}, ${story.status})`);
}

export function auditQuery(actor: string, action: string, storyId: string, detail = "", options: StoryAuditOptions = {}) {
  const changes = fieldChanges(options.before, options.after);
  const references = changes.filter(change => ["assignedTo", "authorId"].includes(change.field)).flatMap(change => [change.before, change.after]).filter((value): value is string => typeof value === "string");
  return workflowDb().execute(sql`insert into audit_log(id,at,actor,action,story_id,detail,context)
    values(${crypto.randomUUID()},${new Date().toISOString()},${actor},${action},${storyId},${detail},
      jsonb_build_object('v',1,'actorId',(select id from users where username=${actor} limit 1),
        'actorName',coalesce((select display_name from users where username=${actor} limit 1),${actor}),
        'rootStoryId',coalesce(${options.rootStoryId ?? null}::text,(select coalesce(revision_of,id) from stories where id=${storyId}),${storyId}),
        'references',coalesce((select jsonb_object_agg(id,display_name) from users where id in (select jsonb_array_elements_text(${JSON.stringify(references)}::jsonb))),'{}'::jsonb))
      || ${JSON.stringify({ changes, ...(options.saveMode ? { saveMode: options.saveMode } : {}) })}::jsonb)`);
}

export function snapshotQuery(id: string, actor: string) {
  return workflowDb().execute(sql`
    insert into story_versions (id, story_id, version, data, actor, created_at)
    select ${crypto.randomUUID()}, s.id, s.version,
      jsonb_build_object('story', to_jsonb(s), 'slides',
        coalesce((select jsonb_agg(to_jsonb(sl) order by sl.position) from story_slides sl where sl.story_id=s.id), '[]'::jsonb),
        'source', (select source from jak_sources where story_id=s.id)),
      ${actor}, ${new Date().toISOString()} from stories s where s.id=${id}
  `);
}

export function copySlides(fromId: string, toId: string) {
  return workflowDb().execute(sql`
    insert into story_slides (id, story_id, position, type, title, body, stat, stat_label, image, image_style, image_prompt, source_context, hidden, data)
    select gen_random_uuid()::text, ${toId}, position, type, title, body, stat, stat_label, image, image_style, image_prompt, source_context, hidden, data
    from story_slides where story_id=${fromId}
  `);
}

export function copySource(fromId: string, toId: string) {
  return workflowDb().execute(sql`
    insert into jak_sources (story_id, source, updated_at)
    select ${toId}, source, ${new Date().toISOString()} from jak_sources where story_id=${fromId}
    on conflict (story_id) do update set source=excluded.source, updated_at=excluded.updated_at
  `);
}

/** ينشر النسخة التي اجتازت الحارس فقط، ويحتفظ بالنسخة السابقة ومصدرها. */
export async function publishCheckedStory(story: WorkflowStory, actor: string, detail: string) {
  const db = workflowDb();
  const now = new Date().toISOString();
  if (!["draft", "review", "scheduled"].includes(story.status)) throw new StoryWriteError("احفظ التعديل كمسودة مراجعة قبل النشر.");
  if (!story.revisionOf) {
    await db.batch([
      lockStory(story),
      db.update(stories).set({ status: "published", returnedAt: null, publishedAt: story.publishedAt ?? now, scheduledAt: null, updatedAt: now, version: story.version + 1 }).where(eq(stories.id, story.id)),
      auditQuery(actor, "status:published", story.id, detail, { before: story, after: { status: "published", returnedAt: null, publishedAt: story.publishedAt ?? now, scheduledAt: null } }),
    ]);
    invalidateStatusCounts();
    return { id: story.id, slug: story.slug, section: story.section, version: story.version + 1 };
  }
  const [original] = await db.select().from(stories).where(eq(stories.id, story.revisionOf)).limit(1);
  if (!original || original.revisionOf || original.version !== story.baseVersion || !["published", "scheduled"].includes(original.status)) {
    throw new StoryWriteError("تغيّرت النسخة الأصلية أو أُرشفت؛ راجع أحدث نسخة قبل الاعتماد.");
  }
  // Generated search text must be recomputed by PostgreSQL, never copied in UPDATE.
  const { id: _id, revisionOf: _revisionOf, baseVersion: _baseVersion, searchText: _searchText, ...content } = story;
  void _id; void _revisionOf; void _baseVersion; void _searchText;
  await db.batch([
    lockStory(original), lockStory(story), snapshotQuery(original.id, actor),
    db.update(stories).set({ ...content, authorId: original.authorId, authorName: original.authorName,
      slug: original.slug, section: original.section, status: "published", returnedAt: null, publishedAt: original.publishedAt ?? now,
      scheduledAt: null, updatedAt: now, version: original.version + 1 }).where(eq(stories.id, original.id)),
    db.execute(sql`delete from story_slides where story_id=${original.id}`),
    copySlides(story.id, original.id), copySource(story.id, original.id),
    db.update(stories).set({ status: "archived", scheduledAt: null, version: story.version + 1, updatedAt: now }).where(eq(stories.id, story.id)),
    auditQuery(actor, "revision:published", original.id, `${detail} · ${story.id}`, { before: original, after: { ...content, authorId: original.authorId, authorName: original.authorName, slug: original.slug, section: original.section, status: "published", returnedAt: null, publishedAt: original.publishedAt ?? now, scheduledAt: null } }),
    auditQuery(actor, "revision:merged", story.id, "اعتماد مسودة التعديل ودمجها في المادة الأصلية", { before: story, after: { status: "archived", scheduledAt: null } }),
  ]);
  invalidateStatusCounts();
  return { id: original.id, slug: original.slug, section: original.section, version: original.version + 1 };
}

/** الاستعادة اقتراح جديد يمر بالحارس والاعتماد المعتاد؛ لا تستبدل الأصل. */
export async function restoreStoryVersion(story: WorkflowStory, versionId: string, expectedVersion: number, actor: WriteActor) {
  assertCanWrite(actor, story);
  assertExpectedVersion(story.version, expectedVersion);
  if (story.revisionOf || !["published", "scheduled"].includes(story.status)) throw new StoryWriteError("استعادة النسخ متاحة من المادة الأصلية المنشورة أو المجدولة.");
  const db = workflowDb();
  const [version] = await db.select().from(storyVersions).where(eq(storyVersions.id, versionId)).limit(1);
  if (!version || version.storyId !== story.id) throw new StoryWriteError("النسخة غير متاحة.", 404);
  const snapshot = version.data as { story: Record<string, unknown>; slides: unknown[]; source: string | null };
  const previous = Object.fromEntries(Object.entries(getTableColumns(stories))
    .filter(([, column]) => !column.generated)
    .map(([key, column]) => [key, snapshot.story[column.name]])) as Omit<WorkflowStory, "searchText">;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.batch([
    lockStory(story),
    db.insert(stories).values({ ...previous, assignedTo: story.assignedTo, dueAt: story.dueAt, returnedAt: null, id, slug: story.slug, section: story.section, authorId: actor.userId, authorName: actor.displayName, status: "draft", revisionOf: story.id, baseVersion: story.version, version: 1, scheduledAt: null, updatedAt: now }),
    db.execute(sql`insert into story_slides (id,story_id,position,type,title,body,stat,stat_label,image,image_style,image_prompt,source_context,hidden,data)
      select gen_random_uuid()::text, ${id}, position,type,title,body,stat,stat_label,image,image_style,image_prompt,source_context,hidden,data
      from jsonb_populate_recordset(null::story_slides, ${JSON.stringify(snapshot.slides)}::jsonb)`),
    db.execute(sql`insert into jak_sources(story_id,source,updated_at) values(${id},${snapshot.source ?? ""},${now})`),
    auditQuery(actor.username, "revision:restore", id, `استعادة النسخة ${version.version}`, { rootStoryId: story.id, before: story, after: { ...previous, assignedTo: story.assignedTo, dueAt: story.dueAt, returnedAt: null, status: "draft", authorId: actor.userId, authorName: actor.displayName, revisionOf: story.id, scheduledAt: null } }),
  ]);
  invalidateStatusCounts();
  return { id, version: 1, format: previous.format };
}
