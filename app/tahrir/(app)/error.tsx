"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** حدود الخطأ داخل الهيكل: الشريط الجانبي والهيدر يبقيان، والرسالة تحل محل محتوى الشاشة وحده. */
export default function TahrirAppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main dir="rtl" className="flex flex-col gap-3">
      <Card className="grid place-items-center gap-3 bg-card px-4 py-12 text-center">
        <AlertTriangle className="size-8 text-muted-foreground" aria-hidden="true" />
        <h1 className="font-display text-xl font-bold">تعذّر فتح هذه الشاشة</h1>
        <p className="max-w-md text-sm leading-7 text-muted-foreground">واجهت اللوحة مشكلة مؤقتة. أعد المحاولة، وإذا استمرت المشكلة فتواصل مع مسؤول النظام.</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={() => reset()}>إعادة المحاولة</Button>
          <Button asChild variant="outline">
            <Link href="/tahrir">نظرة اليوم</Link>
          </Button>
        </div>
      </Card>
    </main>
  );
}
