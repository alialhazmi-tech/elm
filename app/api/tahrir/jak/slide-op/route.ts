import { requirePermission } from "@/lib/tahrir/access";
export async function POST() {
  const gate = await requirePermission("jak.manage");
  if (!gate.ok) return gate.response;
  return Response.json({ error: "جاك العلم المحدثة متوقفة. استخدم قسم جاك العلم لإضافة التقارير." }, { status: 410 });
}
