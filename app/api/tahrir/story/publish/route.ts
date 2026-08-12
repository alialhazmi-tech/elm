import { NextResponse } from "next/server";

import { stripHtmlToText } from "@/lib/content/html";
import { runPolicyGuard } from "@/lib/policy";
import { blockingFindings } from "@/lib/policy/report";
import { APPROVER_ROLES, getSession } from "@/lib/tahrir/auth";
import { revalidatePublicStory } from "@/lib/tahrir/revalidatePublic";
import { getStory, guardMediaFor, setStatus } from "@/lib/tahrir/service";

/**
 * الاعتماد والنشر — للمعتمدين ورئيس التحرير فقط؛ بوابة الاعتماد بشرية دائمًا.
 * الحارس يُفحص هنا أيضًا: صلاحية النشر لا تعلو على المخالفات القاطعة.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "الجلسة منتهية." }, { status: 401 });
  if (!APPROVER_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "الاعتماد من صلاحية المعتمدين فقط." }, { status: 403 });
  }

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
        error: "ممنوع النشر: مخالفات قاطعة لم تُعالج.",
        blocking: report.audit.blockingRuleIds,
        findings: blockingFindings(report),
      },
      { status: 422 },
    );
  }

  await setStatus(story.id, "published", session.username, `نشر بقرار ${session.displayName}`);
  revalidatePublicStory({ section: story.section, id: story.id, slug: story.slug });
  return NextResponse.json({ ok: true });
}
