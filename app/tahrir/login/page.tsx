import { redirect } from "next/navigation";

import { LoginForm } from "@/components/tahrir/login-form";
import { Card } from "@/components/ui/card";
import { getSession } from "@/lib/tahrir/auth";

export const metadata = { title: "الدخول" };

export default async function LoginPage() {
  if (await getSession()) redirect("/tahrir");

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
