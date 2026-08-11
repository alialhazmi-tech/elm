import { NextResponse } from "next/server";

import { getSession } from "@/lib/tahrir/auth";
import { addProposal, decideProposal } from "@/lib/tahrir/service";

/** رفع مقترح سلسلة جديدة — بشروط الدستور الثلاثة. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "الجلسة منتهية." }, { status: 401 });

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
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "الجلسة منتهية." }, { status: 401 });
  if (session.role !== "chief") {
    return NextResponse.json({ error: "قرار المقترحات لرئيس التحرير." }, { status: 403 });
  }

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
