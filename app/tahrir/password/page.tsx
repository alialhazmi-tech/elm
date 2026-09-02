import { redirect } from "next/navigation";

import { PasswordForm } from "@/components/tahrir/account/password-form";
import { Card } from "@/components/ui/card";
import { loadActor } from "@/lib/tahrir/access";

export const metadata = { title: "كلمة المرور" };
export const dynamic = "force-dynamic";

/** خارج مجموعة (app) عمدًا: الـlayout هناك يعيد كل من عليه تغيير كلمته إلى هنا. */
export default async function PasswordPage() {
  const actor = await loadActor();
  if (!actor) redirect("/tahrir/login");

  return (
    <div className="grid min-h-svh place-items-center bg-sidebar p-4 [padding-top:max(2rem,env(safe-area-inset-top))]">
      <Card className="w-full max-w-sm gap-5 bg-card p-7 shadow-2xl">
        <div className="grid gap-1 leading-tight">
          <span className="font-display text-lg font-extrabold">
            {actor.mustChangePassword ? "كلمة مرور جديدة" : "تغيير كلمة المرور"}
          </span>
          <span className="text-xs text-muted-foreground">
            {actor.mustChangePassword
              ? `مرحبًا ${actor.displayName} — كلمة المرور الحالية مؤقتة، اختر كلمتك الخاصة قبل دخول اللوحة.`
              : `${actor.displayName} · ${actor.roleLabel}`}
          </span>
        </div>
        <PasswordForm forced={actor.mustChangePassword} />
      </Card>
    </div>
  );
}
