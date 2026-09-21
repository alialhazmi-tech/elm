"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export function MfaForm({ initialEnabled, configured }: { initialEnabled: boolean; configured: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [setup, setSetup] = useState<{ secret: string; enrollment: string } | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function act(action: string) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/tahrir/account/mfa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, password, code, enrollment: setup?.enrollment }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (action === "begin") setSetup(data);
      else { setEnabled(data.enabled); setCodes(data.recoveryCodes); setSetup(null); setPassword(""); setCode(""); }
    } catch (error) { setError(error instanceof Error ? error.message : "تعذر الاتصال."); }
    finally { setBusy(false); }
  }
  return <section className="grid gap-4 rounded-xl border p-5" dir="rtl">
    <h2 className="text-lg font-bold">التحقق بخطوتين · {enabled ? "مفعّل" : "غير مفعّل"}</h2>
    {!configured && <p>يحتاج التفعيل إلى إعداد مفتاح التشفير من مسؤول النظام.</p>}
    <p>أضف مفتاح الإعداد يدويًا في تطبيق التحقق. ستحتاج كلمة المرور والرمز عند الدخول، ويمكن استخدام كل رمز استرداد مرة واحدة.</p>
    {codes.length > 0 ? <div className="grid gap-3"><strong>احفظ رموز الاسترداد في مدير كلمات المرور؛ لن تُعرض مرة أخرى.</strong><pre dir="ltr" className="overflow-auto text-sm">{codes.join("\n")}</pre><Button onClick={() => setCodes([])}>حفظت رموز الاسترداد</Button></div> : <>
      <Label htmlFor="mfa-password">كلمة المرور الحالية</Label><Input id="mfa-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
      {setup && <div><p>اسم الحساب في تطبيق التحقق: العلم</p><code dir="ltr" className="block break-all select-all">{setup.secret}</code><p>رمز من 6 أرقام، كل 30 ثانية، نوع TOTP.</p></div>}
      {(setup || enabled) && <><Label htmlFor="mfa-code">{enabled ? "رمز التحقق أو الاسترداد لتعطيل الحماية" : "رمز تطبيق التحقق لتأكيد التفعيل"}</Label><Input id="mfa-code" autoComplete="one-time-code" dir="ltr" value={code} maxLength={64} onChange={e => setCode(e.target.value)} /></>}
      <Button disabled={!configured || busy || !password || ((enabled || !!setup) && !code)} onClick={() => act(enabled ? "disable" : setup ? "enable" : "begin")}>{busy ? "جارٍ التحقق…" : enabled ? "تعطيل التحقق بخطوتين" : setup ? "تأكيد التفعيل" : "بدء الإعداد"}</Button>
    </>}
    <p role="alert">{error}</p>
  </section>;
}
