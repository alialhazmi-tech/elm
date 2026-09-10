import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { RecoveryForm } from "./recovery-form";

export const metadata: Metadata = { title: "استعادة كلمة المرور", referrer: "no-referrer", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function RecoveryPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <div className="grid min-h-svh place-items-center bg-sidebar p-4">
    <Card className="w-full max-w-sm gap-5 bg-card p-7 shadow-2xl">
      <div className="grid gap-2"><h1 className="font-display text-xl font-bold">استعادة كلمة المرور</h1><p className="text-sm text-muted-foreground">حسابات إدارة وتحرير العلم</p></div>
      <RecoveryForm token={typeof token === "string" ? token : undefined} />
    </Card>
  </div>;
}
