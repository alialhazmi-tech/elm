"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpenIcon, CompassIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { tourSteps } from "@/lib/tahrir/editorial-tour";

export function HelpTour({ actorId, permissions }: { actorId: string; permissions: string[] }) {
  const [invited, setInvited] = useState(false);
  const [step, setStep] = useState<number | null>(null);
  const key = `tahrir:tour:v1:${actorId}`;
  const steps = tourSteps(permissions);
  const current = step === null ? null : steps[step];
  function remember() { try { localStorage.setItem(key, "seen"); } catch { /* Tour remains usable without storage. */ } }
  function close() { remember(); setInvited(false); setStep(null); }
  useEffect(() => {
    const timer = setTimeout(() => { try { if (!localStorage.getItem(key)) setInvited(true); } catch { /* Do not interrupt every visit when storage is unavailable. */ } }, 1500);
    return () => clearTimeout(timer);
  }, [key]);
  const targetName = current?.target;
  useEffect(() => {
    if (!targetName) return;
    const target = targetName.startsWith("/") ? document.querySelector(`a[data-tour-link="${targetName}"]`) : document.querySelector(`[data-tour="${targetName}"]`);
    target?.classList.add("tahrir-tour-highlight");
    return () => target?.classList.remove("tahrir-tour-highlight");
  }, [targetName]); // The target may be absent outside the editor; the example still explains the step.
  return <>
    <Button asChild size="icon-sm" variant="ghost"><Link href="/tahrir/help" aria-label="دليل الاستخدام"><BookOpenIcon /></Link></Button>
    <Button size="sm" variant="ghost" onClick={() => { remember(); setInvited(false); setStep(0); }} aria-label="ابدأ الجولة التعريفية"><CompassIcon /><span className="hidden xl:inline">ابدأ الجولة</span></Button>
    <Dialog open={invited && step === null} onOpenChange={open => { if (!open) close(); }}>
      <DialogContent dir="rtl"><DialogHeader><DialogTitle>مرحبًا بك في تحرير العلم</DialogTitle><DialogDescription>جولة اختيارية من 6 خطوات تعرّفك بمسار المادة في نحو 3 دقائق. يمكنك إعادتها من زر الجولة أعلى اللوحة.</DialogDescription></DialogHeader><div className="flex gap-2"><Button onClick={() => { remember(); setInvited(false); setStep(0); }}>ابدأ الجولة</Button><Button variant="ghost" onClick={close}>لاحقًا</Button></div></DialogContent>
    </Dialog>
    <Dialog open={step !== null} onOpenChange={open => { if (!open) close(); }}>
      <DialogContent dir="rtl" className="sm:max-w-lg">
        <DialogHeader><p className="mb-2 text-xs text-muted-foreground" aria-live="polite">{(step ?? 0) + 1} من {steps.length} · جولة تحرير العلم</p><DialogTitle>{current?.title}</DialogTitle><DialogDescription className="pt-2 leading-8">{current?.body}</DialogDescription></DialogHeader>
        <div className="rounded-xl border bg-muted/50 p-5 text-center text-sm leading-7">{current?.example}</div>
        <div className="flex gap-1" aria-hidden="true">{steps.map((_, i) => <span key={i} className={`h-1 flex-1 rounded-full ${i <= (step ?? 0) ? "bg-primary" : "bg-muted"}`} />)}</div>
        <div className="flex items-center gap-2"><Button onClick={() => { if (step === 5) close(); else setStep((step ?? 0) + 1); }}>{step === 5 ? "إنهاء الجولة" : "التالي"}</Button><Button variant="outline" disabled={step === 0} onClick={() => setStep((step ?? 1) - 1)}>السابق</Button><Button variant="ghost" className="ms-auto" onClick={close}>تخطي</Button></div>
        <p className="text-xs leading-6 text-muted-foreground">الجولة تشرح الأدوات ولا تعدّل موادك. الخطوات مرتبطة بصلاحيات حسابك. <Link href="/tahrir/help" onClick={close} className="underline">دليل الاستخدام الكامل</Link></p>
      </DialogContent>
    </Dialog>
  </>;
}
