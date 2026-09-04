import { assertExpectedVersion, writeError } from "@/lib/tahrir/write-policy";
import { NextResponse } from "next/server";

import { stripHtmlToText } from "@/lib/content/html";
import { loadAiSettings } from "@/lib/ai/settings";
import { runConfiguredPolicyGuard } from "@/lib/policy";
import { blockingFindings } from "@/lib/policy/report";
import { requirePermission } from "@/lib/tahrir/access";
import { revalidatePublicStory } from "@/lib/tahrir/revalidatePublic";
import { getStory, guardMediaFor, setStatus } from "@/lib/tahrir/service";

/**
 * الاعتماد والنشر — للمعتمدين ورئيس التحرير فقط؛ بوابة الاعتماد بشرية دائمًا.
 * الحارس يُفحص هنا أيضًا: صلاحية النشر لا تعلو على المخالفات القاطعة.
 */
export async function POST(request: Request) {
  try { return await transition(request); } catch (error) { return writeError(error); }
}
async function transition(request: Request) {
  const gate = await requirePermission("story.publish", "الاعتماد من صلاحية المعتمدين فقط.");
  if (!gate.ok) return gate.response;
  const session = gate.actor;

  const { id, expectedVersion } = (await request.json().catch(() => ({}))) as { id?: string; expectedVersion?: number };
  const story = id ? await getStory(id) : null;
  if (!story) return NextResponse.json({ error: "المادة غير موجودة." }, { status: 404 });
  assertExpectedVersion(story.version, expectedVersion);

  const [settings, media] = await Promise.all([loadAiSettings(), guardMediaFor(story.image)]);
  const report = runConfiguredPolicyGuard({
    id: story.id,
    title: story.title,
    body: stripHtmlToText(story.body),
    surface: story.format === "jakalelm" ? ("design" as const) : undefined,
    media,
  }, settings.governance);
  if (!report.canRequestApproval) {
    return NextResponse.json(
      {
        error: "ممنوع النشر: مخالفات قاطعة لم تُعالج.",
        blocking: report.audit.blockingRuleIds,
        findings: blockingFindings(report),
      },
      { status: 422 },
    );
  }

  const result = await setStatus(story, "published", session.username, `نشر بقرار ${session.displayName}`);
  revalidatePublicStory(result);
  return NextResponse.json({ ok: true, ...result });
}
