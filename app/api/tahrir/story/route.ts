import { writeError } from "@/lib/tahrir/write-policy";
import { NextResponse } from "next/server";

import { looksLikeHtml, sanitizeBodyHtml, stripHtmlToText } from "@/lib/content/html";
import { normalizeVideoUrl } from "@/lib/content/video";
import { canEditStory, requireActor } from "@/lib/tahrir/access";
import { appStoryList } from "@/lib/tahrir/app-read";
import { deleteDraft, getStory, saveDraft } from "@/lib/tahrir/service";
import { revalidatePublicStory } from "@/lib/tahrir/revalidatePublic";
import { loadAiSettings } from "@/lib/ai/settings";
import { runConfiguredPolicyGuard } from "@/lib/policy";
import { blockingFindings } from "@/lib/policy/report";
import { buildGuardDraft, loadGuardContext } from "@/lib/tahrir/guard-draft";
import { guardMediaFor } from "@/lib/tahrir/service";

/** قائمة المواد للتطبيق — منطق شاشة «المواد» نفسه (30/صفحة، الفلاتر، قصّ رقم الصفحة). */
export async function GET(request: Request) {
  const gate = await requireActor();
  if (!gate.ok) return gate.response;
  const params = new URL(request.url).searchParams;
  const payload = await appStoryList(gate.actor, {
    status: params.get("status"),
    p: params.get("p"),
    q: params.get("q"),
    series: params.get("series"),
  });
  return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  try { return await saveStory(request); } catch (error) { return writeError(error); }
}
async function saveStory(request: Request) {
  const gate = await requireActor();
  if (!gate.ok) return gate.response;
  const session = gate.actor;

  const input = (await request.json().catch(() => null)) as {
    id?: string;
    expectedVersion?: number;
    autosave?: boolean;
    returnToDraft?: boolean;
    updateScheduled?: boolean;
    rescheduleAt?: string;
    title?: string;
    excerpt?: string;
    body?: string;
    section?: string;
    slug?: string;
    seriesSlug?: string | null;
    image?: string | null;
    format?: string;
    seoTitle?: string;
    seoDescription?: string;
    keywords?: string[];
    pinned?: boolean;
    breakingUntil?: string | null;
    videoUrl?: string | null;
  } | null;

  const automatic = input?.autosave === true;
  const returnToDraft = input?.returnToDraft === true;
  const updateScheduled = input?.updateScheduled === true;
  if (updateScheduled && !session.can("story.schedule")) {
    return NextResponse.json({ error: "تحديث المجدول من صلاحية المعتمدين فقط." }, { status: 403 });
  }
  if (input?.rescheduleAt !== undefined && (!updateScheduled || typeof input.rescheduleAt !== "string")) {
    return NextResponse.json({ error: "مدخل موعد النشر غير صالح." }, { status: 400 });
  }
  if (returnToDraft && !session.can("story.publish")) {
    return NextResponse.json({ error: "التحويل إلى مسودة من صلاحية المعتمدين فقط." }, { status: 403 });
  }
  if (returnToDraft && automatic) {
    return NextResponse.json({ error: "التحويل إلى مسودة يتطلب إجراءً يدويًا." }, { status: 400 });
  }
  if (!input || typeof input.title !== "string" || (!input.title.trim() && !automatic)) {
    return NextResponse.json({ error: "العنوان مطلوب." }, { status: 400 });
  }
  for (const field of ["id", "excerpt", "body", "section", "slug", "seriesSlug", "image", "format", "seoTitle", "seoDescription", "videoUrl"] as const) {
    if (input[field] != null && typeof input[field] !== "string") return NextResponse.json({ error: "مدخل غير صالح." }, { status: 400 });
  }
  if (input.title.length > 500 || (input.body?.length ?? 0) > 200_000) return NextResponse.json({ error: "تجاوز النص الحد المسموح." }, { status: 413 });
  const videoUrl = normalizeVideoUrl(input.videoUrl);
  if (input.format?.trim() === "videos" && !videoUrl) {
    return NextResponse.json({ error: "رابط يوتيوب أو تغريدة X أو فيديو/ريلز إنستقرام صحيح مطلوب للمادة المرئية." }, { status: 400 });
  }

  const id = input.id?.trim() || crypto.randomUUID();
  // مادة جديدة تحتاج story.create؛ القائمة يحررها صاحبها بـ edit.own أو أي عضو بـ edit.any.
  const existing = input.id?.trim() ? await getStory(id) : null;
  if (!canEditStory(session, existing)) {
    return NextResponse.json({ error: existing ? "لا تملك صلاحية تحرير هذه المادة." : "ليست لديك صلاحية إنشاء مادة." }, { status: 403 });
  }
  if (automatic && existing && existing.status !== "draft") {
    return NextResponse.json({ error: "تغيّرت حالة المادة؛ الحفظ التلقائي للمسودات فقط. راجع أحدث نسخة قبل حفظ التعديل." }, { status: 409 });
  }
  if (automatic && !existing && !input.title.trim() && !stripHtmlToText(input.body ?? "").trim()) {
    return NextResponse.json({ error: "أضف عنوانًا أو متنًا لبدء حفظ المسودة." }, { status: 400 });
  }
  // مواد «جاك العلم»: المتن إسقاط آلي من الشرائح (`lib/tahrir/jak.ts`) والشكل ثابت — أي عميل
  // (ومنه التطبيق) لا يستطيع الكتابة فوق الإسقاط أو تبديل الشكل عبر هذا المسار؛ الشرائح من `jak/slides`.
  const isJak = existing?.format === "jakalelm";
  if (existing && !isJak && input.format?.trim() === "jakalelm") {
    return NextResponse.json({ error: "تقارير جاك العلم تُنشأ من محررها؛ لا يمكن تحويل مادة قائمة إلى تقرير." }, { status: 409 });
  }
  // متن المحرر الغني يُنقّى عند الحفظ — والعرض ينقّي ثانية (القاعدة ليست مصدر ثقة).
  const rawBody = isJak ? (existing?.body ?? "") : (input.body ?? "");
  const body = looksLikeHtml(rawBody) ? sanitizeBodyHtml(rawBody) : rawBody;
  const keywords = Array.isArray(input.keywords)
    ? input.keywords
        .filter((keyword): keyword is string => typeof keyword === "string")
        .map((keyword) => keyword.trim())
        .filter(Boolean)
        .slice(0, 12)
        .map((keyword) => keyword.slice(0, 40))
    : undefined;
  const slug = input.slug?.trim() ?? "";

  if (updateScheduled) {
    const settingsPromise = loadAiSettings();
    const [settings, media, context] = await Promise.all([
      settingsPromise, guardMediaFor(input.image?.trim() || null), loadGuardContext(settingsPromise, session.userId),
    ]);
    const report = runConfiguredPolicyGuard(buildGuardDraft({
      id, title: input.title.trim(), body, format: isJak ? "jakalelm" : (input.format?.trim() || existing?.format || "news"),
      image: input.image?.trim() || null,
      breakingUntil: session.can("story.publish") && input.breakingUntil !== undefined ? input.breakingUntil : existing?.breakingUntil,
      media,
    }), settings.governance, context);
    if (!report.canRequestApproval) return NextResponse.json({
      error: "تعذر تحديث المجدول: عالج مخالفات الحارس أولًا.",
      blocking: report.audit.blockingRuleIds, findings: blockingFindings(report),
    }, { status: 422 });
  }

  const saved = await saveDraft(
    {
      id,
      expectedVersion: input.expectedVersion,
      autosave: automatic,
      returnToDraft,
      updateScheduled,
      rescheduleAt: input.rescheduleAt,
      title: input.title.trim(),
      excerpt: input.excerpt?.trim() ?? "",
      body,
      section: input.section?.trim() || "news",
      slug,
      seriesSlug: input.seriesSlug || null,
      image: input.image?.trim() || null,
      format: isJak ? "jakalelm" : (input.format?.trim() || undefined),
      seoTitle: input.seoTitle?.trim().slice(0, 90) ?? "",
      seoDescription: input.seoDescription?.trim().slice(0, 200) ?? "",
      keywords,
      // رابط الفيديو يقبل يوتيوب وتغريدات X ومنشورات إنستقرام العامة ويُخزَّن بصيغته القياسية؛ أي قيمة أخرى تُمسح.
      ...(input.videoUrl !== undefined ? { videoUrl } : {}),
      ...(session.can("story.publish")
        ? { pinned: input.pinned, breakingUntil: input.breakingUntil }
        : {}),
    },
    session,
  );
  if (returnToDraft) revalidatePublicStory(saved);
  return NextResponse.json({ ok: true, ...saved });
}

export async function DELETE(request: Request) {
  const gate = await requireActor();
  if (!gate.ok) return gate.response;
  const session = gate.actor;

  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id?.trim()) return NextResponse.json({ error: "معرف المسودة مطلوب." }, { status: 400 });
  const existing = await getStory(id.trim()).catch(() => null);
  if (existing && !canEditStory(session, existing)) {
    return NextResponse.json({ error: "لا تملك صلاحية حذف هذه المسودة." }, { status: 403 });
  }

  const result = await deleteDraft(id.trim(), session.username);
  if (result === "not-found") {
    return NextResponse.json({ error: "المسودة غير موجودة." }, { status: 404 });
  }
  if (result === "not-draft") {
    return NextResponse.json({ error: "الحذف النهائي متاح للمسودات فقط. المادة المنشورة تُأرشف لتُخفى عن الموقع مع حفظ السبب." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
