-- برامج البودكاست وحلقاتها المرفوعة تُدار من اللوحة بدل الثوابت في lib/podcasts.ts.
CREATE TABLE IF NOT EXISTS "podcast_shows" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"cover" text,
	"accent" text NOT NULL,
	"feed_url" text,
	"youtube" text NOT NULL,
	"story_id" text,
	"visible" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "podcast_shows_visible" CHECK ("podcast_shows"."visible" in (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "podcast_shows_story_idx" ON "podcast_shows" USING btree ("story_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "podcast_episodes" (
	"id" text PRIMARY KEY NOT NULL,
	"show_id" text NOT NULL REFERENCES "podcast_shows"("id"),
	"title" text NOT NULL,
	"guest" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"filename" text NOT NULL,
	"object_key" text NOT NULL,
	"mime" text NOT NULL,
	"byte_length" integer NOT NULL,
	"etag" text NOT NULL,
	"duration_seconds" integer,
	"published_at" text NOT NULL,
	"visible" integer DEFAULT 1 NOT NULL,
	"source_url" text,
	"created_by" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "podcast_episodes_visible" CHECK ("podcast_episodes"."visible" in (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "podcast_episodes_filename_idx" ON "podcast_episodes" USING btree ("filename");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "podcast_episodes_show_time_idx" ON "podcast_episodes" USING btree ("show_id", "published_at" DESC NULLS LAST);
--> statement-breakpoint
INSERT INTO "podcast_shows" ("id", "name", "cover", "accent", "feed_url", "youtube", "story_id", "sort_order", "created_at", "updated_at") VALUES
	('alghabouq', 'الغبوق', '/podcasts/alghabouq.jpg', '#b35c1e', 'https://media.rss.com/alghabouk/feed.xml', 'https://www.youtube.com/c/alelmmedia', '175839', 1, '2026-09-27T00:00:00.000Z', '2026-09-27T00:00:00.000Z'),
	('malameh', 'ملامح', NULL, '#2B5C9E', 'https://media.rss.com/malameh/feed.xml', 'https://www.youtube.com/c/alelmmedia', '92137', 2, '2026-09-27T00:00:00.000Z', '2026-09-27T00:00:00.000Z'),
	('atmah', 'عتمة', NULL, '#c9932e', 'https://media.rss.com/atmahpodcast/feed.xml', 'https://www.youtube.com/c/alelmmedia', '71148', 3, '2026-09-27T00:00:00.000Z', '2026-09-27T00:00:00.000Z'),
	('taqrir', 'تقرير', NULL, '#1f8f8a', 'https://media.rss.com/alelmbodcast/feed.xml', 'https://www.youtube.com/c/alelmmedia', '70190', 4, '2026-09-27T00:00:00.000Z', '2026-09-27T00:00:00.000Z')
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "podcast_episodes" ("id", "show_id", "title", "guest", "description", "filename", "object_key", "mime", "byte_length", "etag", "duration_seconds", "published_at", "source_url", "created_by", "created_at", "updated_at") VALUES
	('hosted-alsubai-reading', 'alghabouq', 'كيف نصبح قرّاء أفضل؟', 'د. محمد الصبي', 'القراءة السريعة ليست مجرد تحصيل كلمات أكثر في وقت أقل.. في هذه الحلقة من بودكاست الغبوق، نستكشف مع د. محمد الصبي، عميد الأكاديمية العربية للقراءة السريعة، كيف تتحول القراءة إلى مهارة أكثر كفاءة، وكيف يساعد التدريب على زيادة سرعة القراءة مع الحفاظ على الفهم والاستيعاب.', 'alsubai-reading-b8cb32089f7b.m4a', 'podcasts/alghabouq/alsubai-reading-b8cb32089f7b.m4a', 'audio/mp4', 73160584, 'b8cb32089f7b9cfabe85ed20e879beb1208e4d4db0c93db006024492ab3f4118', 4517, '2026-09-27T14:43:00.000Z', 'https://drive.google.com/file/d/1uqCmFFynmV5enli3AQmrIGLGskoGpvdM/view', 'ali', '2026-09-27T14:43:00.000Z', '2026-09-27T14:43:00.000Z'),
	('hosted-_UGwxxWb4iw', 'alghabouq', 'لماذا أصبحت تربية الأطفال مهمة شاقة؟', 'همام الحارثي', '', '_UGwxxWb4iw-40add49a9b5e.m4a', 'podcasts/alghabouq/_UGwxxWb4iw-40add49a9b5e.m4a', 'audio/mp4', 68374801, '40add49a9b5e5b511173a79f7659638b53a6071e59ee21252f05554331ab09de', 4228, '2026-08-18T18:29:50.000Z', 'https://www.youtube.com/watch?v=_UGwxxWb4iw', 'ali', '2026-09-08T12:16:26.000Z', '2026-09-08T12:16:26.000Z'),
	('hosted-KP5TyvDbRBY', 'alghabouq', 'العقل الذي لا نعرفه.. كيف يصنع أفكارنا وسلوكنا؟', 'طالب خفاجي', '', 'KP5TyvDbRBY-46d745aa20f7.m4a', 'podcasts/alghabouq/KP5TyvDbRBY-46d745aa20f7.m4a', 'audio/mp4', 107746799, '46d745aa20f7da08ef9a8117f6beb9c3ef03401f3db0c39909014ad6bda8a6e2', 6662, '2026-07-16T18:10:50.000Z', 'https://www.youtube.com/watch?v=KP5TyvDbRBY', 'ali', '2026-09-08T12:16:26.000Z', '2026-09-08T12:16:26.000Z')
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO role_permissions (role_id, permission_key)
SELECT id, permission_key
FROM roles
CROSS JOIN (VALUES ('podcasts.manage')) AS granted(permission_key)
WHERE id IN ('chief', 'managing_editor')
ON CONFLICT (role_id, permission_key) DO NOTHING;
