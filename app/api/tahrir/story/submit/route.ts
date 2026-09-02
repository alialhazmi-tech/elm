import { NextResponse } from "next/server";

import { stripHtmlToText } from "@/lib/content/html";
import { runPolicyGuard } from "@/lib/policy";
import { blockingFindings } from "@/lib/policy/report";
import { requirePermission } from "@/lib/tahrir/access";
import { getStory, guardMediaFor, setStatus } from "@/lib/tahrir/service";

/**
 * طلب الاعتماد — بوابة الحارس تُفرض هنا على الخادم لا في الواجهة فقط:
 * أي مخالفة قاطعة تعيد 422 وتمنع الإرسال مهما تحايلت الواجهة.
 */
export async function POST(request: Request) {
  const gate = await requirePermission("story.submit");
  if (!gate.ok) return gate.response;
  const session = gate.actor;

  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  const story = id ? await getStory(id) : null;
  if (!story) return NextResponse.json({ error: "المادة غير موجودة." }, { status: 404 });

  const report = runPolicyGuard({
    id: story.id,
    title: story.title,
    body: stripHtmlToText(story.body),
    surface: story.format === "jakalelm" ? ("design" as const) : undefined,
    media: await guardMediaFor(story.image),
  });
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

  await setStatus(story.id, "review", session.username, `طلب اعتماد من ${session.displayName}`);
  return NextResponse.json({ ok: true });
}
