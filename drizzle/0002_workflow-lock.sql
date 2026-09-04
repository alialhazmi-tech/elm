-- Existing bylines are intentionally not treated as identity proof.
CREATE OR REPLACE FUNCTION alelm_assert_story_version(story_key text, expected integer, expected_status text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual integer; actual_status text;
BEGIN
  SELECT version, status INTO actual, actual_status FROM stories WHERE id=story_key FOR UPDATE;
  IF actual IS NULL OR actual <> expected OR actual_status <> expected_status THEN
    RAISE EXCEPTION 'story revision conflict' USING ERRCODE='40001';
  END IF;
END;
$$;
--> statement-breakpoint
-- Preserve the existing web saved list while separating future likes and saves.
INSERT INTO member_saved_stories (member_id, story_id, created_at)
SELECT member_id, story_id, created_at FROM member_likes ON CONFLICT DO NOTHING;
