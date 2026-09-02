import { NextResponse } from "next/server";

import { stripHtmlToText } from "@/lib/content/html";
import { runPolicyGuard } from "@/lib/policy";
import { blockingFindings } from "@/lib/policy/report";
import { requirePermission } from "@/lib/tahrir/access";
import { revalidatePublicStory } from "@/lib/tahrir/revalidatePublic";
import { getStory, scheduleStory } from "@/lib/tahrir/service";

/** جدولة النشر — للمعتمدين؛ الحارس يفحص عند الجدولة وسيفحص ثانية لحظة الموعد. */
export async function POST(request: Request) {
  const gate = await requirePermission("story.schedule", "الجدولة من صلاحية المعتمدين.");
  if (!gate.ok) return gate.response;
  const session = gate.actor;

  const { id, scheduledAt } = (await request.json().catch(() => ({}))) as {
    id?: string;
    scheduledAt?: string;
  };

  const when = scheduledAt ? new Date(scheduledAt) : null;
  if (!when || Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
    return NextResponse.json({ error: "اختر موعدًا مستقبليًا صحيحًا." }, { status: 400 });
  }

  const story = id ? await getStory(id) : null;
  if (!story) return NextResponse.json({ error: "المادة غير موجودة." }, { status: 404 });

  const report = runPolicyGuard({
    id: story.id,
    title: story.title,
    body: stripHtmlToText(story.body),
    surface: story.format === "jakalelm" ? ("design" as const) : undefined,
  });
  if (!report.canRequestApproval) {
    return NextResponse.json(
      {
        error: "ممنوعة الجدولة: مخالفات قاطعة لم تُعالج.",
        blocking: report.audit.blockingRuleIds,
        findings: blockingFindings(report),
      },
      { status: 422 },
    );
  }

  await scheduleStory(story.id, when.toISOString(), session.username);
  // إن كانت منشورة سابقًا يجب أن تختفي من الموقع فورًا، لا بعد 300 ثانية.
  revalidatePublicStory({ section: story.section, id: story.id, slug: story.slug });
  return NextResponse.json({ ok: true });
}
