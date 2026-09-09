"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

/** حدود الخطأ لجذر اللوحة (الدخول وكلمة المرور والهيكل نفسه): Next يمرّر reset لا retry. */
export default function TahrirError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main dir="rtl" className="grid min-h-svh place-items-center bg-background px-6 py-12 text-foreground">
      <div className="w-full max-w-md text-center">
        <AlertTriangle className="mx-auto mb-6 size-10 text-muted-foreground" aria-hidden="true" />
        <p className="mb-3 text-sm text-muted-foreground">تحرير العلم</p>
        <h1 className="font-display text-2xl font-bold leading-relaxed">تعذّر فتح لوحة التحكم</h1>
        <p className="mt-4 leading-8 text-muted-foreground">واجهت اللوحة مشكلة مؤقتة. أعد المحاولة، وإذا استمرت المشكلة فتواصل مع مسؤول النظام.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => reset()} className="min-h-11 rounded-xl bg-primary px-6 font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-4">إعادة المحاولة</button>
          <Link href="/" className="inline-flex min-h-11 items-center rounded-xl border border-border px-6 focus-visible:outline-2 focus-visible:outline-offset-4">العودة إلى الموقع</Link>
        </div>
      </div>
    </main>
  );
}
