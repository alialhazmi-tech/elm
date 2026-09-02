import { redirect } from "next/navigation";

import { LoginForm } from "@/components/tahrir/login-form";
import { Card } from "@/components/ui/card";
import { loadActor } from "@/lib/tahrir/access";

export const metadata = { title: "الدخول" };

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // loadActor لا getSession: كوكي عضو معلّق تبقى موقّعة، فلا نعيده إلى اللوحة التي ستعيده إلينا.
  const actor = await loadActor();
  if (actor) redirect(actor.mustChangePassword ? "/tahrir/password" : "/tahrir");

  return (
    <div className="grid min-h-svh place-items-center bg-sidebar p-4 [padding-top:max(2rem,env(safe-area-inset-top))]">
      <Card className="w-full max-w-sm gap-5 bg-card p-7 shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary font-display text-xl font-extrabold text-primary-foreground">
            ع
          </span>
          <div className="grid leading-tight">
            <span className="font-display text-lg font-extrabold">تحرير العلم</span>
            <span className="text-xs text-muted-foreground">لوحة التحكم — المعرفة بسلاسة</span>
          </div>
        </div>
        <LoginForm />
      </Card>
    </div>
  );
}
