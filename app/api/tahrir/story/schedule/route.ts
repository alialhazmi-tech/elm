import { NextResponse } from "next/server";

import { runPolicyGuard } from "@/lib/policy";
import { APPROVER_ROLES, getSession } from "@/lib/tahrir/auth";
import { getStory, scheduleStory } from "@/lib/tahrir/service";

/** جدولة النشر — للمعتمدين؛ الحارس يفحص عند الجدولة وسيفحص ثانية لحظة الموعد. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "الجلسة منتهية." }, { status: 401 });
  if (!APPROVER_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "الجدولة من صلاحية المعتمدين." }, { status: 403 });
  }

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

  const report = runPolicyGuard({ id: story.id, title: story.title, body: story.body });
  if (!report.canRequestApproval) {
    return NextResponse.json(
      { error: "ممنوعة الجدولة: مخالفات قاطعة لم تُعالج.", blocking: report.audit.blockingRuleIds },
      { status: 422 },
    );
  }

  await scheduleStory(story.id, when.toISOString(), session.username);
  return NextResponse.json({ ok: true });
}
