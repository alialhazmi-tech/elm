/** بوابة شاشات اللوحة (مكونات الخادم فقط) — فوق loadActor في access.ts. */

import { createElement, type ReactElement } from "react";
import { redirect } from "next/navigation";

import { Forbidden } from "@/components/tahrir/forbidden";

import { loadActor, type Actor } from "./access";

export type ScreenGate = { ok: true; actor: Actor } | { ok: false; element: ReactElement };

/**
 * بلا جلسة → الدخول؛ بلا الصلاحية → شاشة «بلا صلاحية» بدل المحتوى (لا إعادة توجيه صامتة). الاستعمال:
 *   const gate = await requireScreen("stats.view", "الإحصاءات");
 *   if (!gate.ok) return gate.element;
 * كلمة المرور المؤقتة والتحقق بخطوتين يعالجهما layout المجموعة بإعادة التوجيه قبل الوصول هنا.
 */
export async function requireScreen(permission: string, title: string): Promise<ScreenGate> {
  const actor = await loadActor();
  if (!actor) redirect("/tahrir/login");
  if (!actor.can(permission)) return { ok: false, element: createElement(Forbidden, { title, permission }) };
  return { ok: true, actor };
}
