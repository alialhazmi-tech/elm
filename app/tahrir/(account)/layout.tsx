import { redirect } from "next/navigation";

import { AppShell } from "@/components/tahrir/app-shell";
import { loadActor } from "@/lib/tahrir/access";

/** شاشات الحساب التي يجب أن تبقى متاحة لمن أُلزم بتفعيل التحقق بخطوتين — الهيكل نفسه بلا إعادة توجيه MFA. */
export default async function TahrirAccountLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const actor = await loadActor();
  if (!actor) redirect("/tahrir/login");
  if (actor.mustChangePassword) redirect("/tahrir/password");

  return <AppShell actor={actor}>{children}</AppShell>;
}
