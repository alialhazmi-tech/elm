import { assertExpectedVersion, writeError } from "@/lib/tahrir/write-policy";
import { NextResponse } from "next/server";

import { loadAiSettings } from "@/lib/ai/settings";
import { runConfiguredPolicyGuard } from "@/lib/policy";
import { blockingFindings } from "@/lib/policy/report";
import { requirePermission } from "@/lib/tahrir/access";
import { buildGuardDraft, loadGuardContext } from "@/lib/tahrir/guard-draft";
import { revalidatePublicStory } from "@/lib/tahrir/revalidatePublic";
import { getStory, guardMediaFor, scheduleStory } from "@/lib/tahrir/service";

/** جدولة النشر — لحامل صلاحية الجدولة؛ الحارس يفحص هنا وثانية لحظة الموعد. */
export async function POST(request: Request) {
  try { return await transition(request); } catch (error) { return writeError(error); }
}
async function transition(request: Request) {
  const gate = await requirePermission("story.schedule", "لا تملك صلاحية جدولة النشر.");
  if (!gate.ok) return gate.response;
  const session = gate.actor;

  const { id, scheduledAt, expectedVersion } = (await request.json().catch(() => ({}))) as {
    id?: string;
    scheduledAt?: string; expectedVersion?: number;
  };

  const when = scheduledAt ? new Date(scheduledAt) : null;
  if (!when || Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
    return NextResponse.json({ error: "اختر موعدًا مستقبليًا صحيحًا." }, { status: 400 });
  }

  const story = id ? await getStory(id) : null;
  if (!story) return NextResponse.json({ error: "المادة غير موجودة." }, { status: 404 });
  assertExpectedVersion(story.version, expectedVersion);

  const settingsPromise = loadAiSettings();
  const [settings, media, context] = await Promise.all([settingsPromise, guardMediaFor(story.image), loadGuardContext(settingsPromise, session.userId)]);
  const report = runConfiguredPolicyGuard(
    buildGuardDraft({ id: story.id, title: story.title, body: story.body, format: story.format, image: story.image, breakingUntil: story.breakingUntil, media }),
    settings.governance,
    context,
  );
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

  const result = await scheduleStory(story, when.toISOString(), session.username);
  // إن كانت منشورة سابقًا يجب أن تختفي من الموقع فورًا، لا بعد 300 ثانية.
  revalidatePublicStory(story);
  return NextResponse.json({ ok: true, ...result });
}
