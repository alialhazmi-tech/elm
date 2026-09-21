/** بوابة شاشات اللوحة (مكونات الخادم فقط) — فوق loadActor في access.ts. */

import { createElement, type ReactElement } from "react";
import { redirect } from "next/navigation";

import { Forbidden } from "@/components/tahrir/forbidden";

import { loadActor, type Actor } from "./access";

export type ScreenGate = { ok: true; actor: Actor } | { ok: false; element: ReactElement };

/** يُستدعى داخل الصفحة أيضًا: تخطيط App Router قد يُعاد استخدامه عند التنقل. */
export async function requireScreenActor(): Promise<Actor> {
  const actor = await loadActor();
  if (!actor) redirect("/tahrir/login");
  if (actor.mustChangePassword) redirect("/tahrir/password");
  if (actor.mfaRequired) redirect("/tahrir/security");
  return actor;
}

/**
 * بلا جلسة → الدخول؛ بلا الصلاحية → شاشة «بلا صلاحية» بدل المحتوى (لا إعادة توجيه صامتة). الاستعمال:
 *   const gate = await requireScreen("stats.view", "الإحصاءات");
 *   if (!gate.ok) return gate.element;
 * تُفحص كلمة المرور المؤقتة والتحقق بخطوتين هنا أيضًا عند إعادة استخدام layout المجموعة.
 */
export async function requireScreen(permission: string, title: string): Promise<ScreenGate> {
  const actor = await requireScreenActor();
  if (!actor.can(permission)) return { ok: false, element: createElement(Forbidden, { title, permission }) };
  return { ok: true, actor };
}
