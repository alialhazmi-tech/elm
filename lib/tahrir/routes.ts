/** مسار المحرر الصحيح لكل شكل مادة — مصدر واحد لكل قوائم لوحة التحرير. */
export function editorHref(story: { id: string; format?: string | null }): string {
  return story.format === "jakalelm"
    ? `/tahrir/jak/${story.id}`
    : `/tahrir/editor/${story.id}`;
}
