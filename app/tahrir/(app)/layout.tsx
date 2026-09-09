import { redirect } from "next/navigation";

import { AppShell } from "@/components/tahrir/app-shell";
import { loadActor } from "@/lib/tahrir/access";

export default async function TahrirAppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // الفاعل يُحلّ من القاعدة عند كل طلب: التعليق وتغيير الدور يسريان فورًا، والرمز يحمل الهوية فقط.
  const actor = await loadActor();
  if (!actor) redirect("/tahrir/login");
  if (actor.mustChangePassword) redirect("/tahrir/password");
  // حساب إداري بلا تحقق بخطوتين: لا شاشة قبل «أمان الحساب» (في مجموعة (account) كي لا تدور الإعادة).
  if (actor.mfaRequired) redirect("/tahrir/security");

  return <AppShell actor={actor}>{children}</AppShell>;
}
