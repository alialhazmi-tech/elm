import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/tahrir/access";
import { addProposal, decideProposal } from "@/lib/tahrir/service";

/** رفع مقترح سلسلة جديدة — بشروط الدستور الثلاثة. */
export async function POST(request: Request) {
  const gate = await requirePermission("series.propose");
  if (!gate.ok) return gate.response;
  const session = gate.actor;

  const input = (await request.json().catch(() => null)) as {
    name?: string;
    valueCase?: string;
    gapCase?: string;
    impactCase?: string;
  } | null;

  if (!input?.name?.trim() || !input.valueCase?.trim() || !input.gapCase?.trim() || !input.impactCase?.trim()) {
    return NextResponse.json(
      { error: "الشروط الثلاثة مطلوبة كاملة: القيمة، والفجوة، والأثر المتوقع." },
      { status: 400 },
    );
  }

  await addProposal(
    {
      name: input.name.trim(),
      valueCase: input.valueCase.trim(),
      gapCase: input.gapCase.trim(),
      impactCase: input.impactCase.trim(),
    },
    session.displayName,
  );
  return NextResponse.json({ ok: true });
}

/** قرار رئيس التحرير في مقترح: قبول (تفعيله التقني إصدار لاحق) أو رفض. */
export async function PATCH(request: Request) {
  const gate = await requirePermission("series.decide", "قرار المقترحات لرئيس التحرير.");
  if (!gate.ok) return gate.response;
  const session = gate.actor;

  const { id, decision } = (await request.json().catch(() => ({}))) as {
    id?: string;
    decision?: "accepted" | "rejected";
  };
  if (!id || (decision !== "accepted" && decision !== "rejected")) {
    return NextResponse.json({ error: "معرف وقرار صحيحان مطلوبان." }, { status: 400 });
  }

  await decideProposal(id, decision, session.username);
  return NextResponse.json({ ok: true });
}
