import { assertCanWrite, assertExpectedVersion, writeError } from "@/lib/tahrir/write-policy";
import { NextResponse } from "next/server";

import { loadAiSettings } from "@/lib/ai/settings";
import { runConfiguredPolicyGuard } from "@/lib/policy";
import { blockingFindings } from "@/lib/policy/report";
import { requirePermission } from "@/lib/tahrir/access";
import { buildGuardDraft, loadGuardContext } from "@/lib/tahrir/guard-draft";
import { getStory, guardMediaFor, setStatus } from "@/lib/tahrir/service";

/**
 * طلب الاعتماد — بوابة الحارس تُفرض هنا على الخادم لا في الواجهة فقط:
 * أي مخالفة قاطعة تعيد 422 وتمنع الإرسال مهما تحايلت الواجهة.
 */
export async function POST(request: Request) {
  try { return await transition(request); } catch (error) { return writeError(error); }
}
async function transition(request: Request) {
  const gate = await requirePermission("story.submit");
  if (!gate.ok) return gate.response;
  const session = gate.actor;

  const { id, expectedVersion } = (await request.json().catch(() => ({}))) as { id?: string; expectedVersion?: number };
  const story = id ? await getStory(id) : null;
  if (!story) return NextResponse.json({ error: "المادة غير موجودة." }, { status: 404 });
  assertExpectedVersion(story.version, expectedVersion);

  assertCanWrite(session, story);
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
        error: "ممنوع طلب الاعتماد حتى معالجة المخالفات القاطعة.",
        blocking: report.audit.blockingRuleIds,
        findings: blockingFindings(report),
      },
      { status: 422 },
    );
  }

  const result = await setStatus(story, "review", session.username, `طلب اعتماد من ${session.displayName}`);
  return NextResponse.json({ ok: true, ...result });
}
