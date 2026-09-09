import { SystemSettingsClient } from "@/components/tahrir/settings/system-settings-client";
import { loadAiSettings } from "@/lib/ai/settings";
import { requireScreen } from "@/lib/tahrir/screen";

export const metadata = { title: "إعدادات النظام" };
export const dynamic = "force-dynamic";

export default async function SystemSettingsPage() {
  const gate = await requireScreen("ai.settings", "إعدادات النظام");
  if (!gate.ok) return gate.element;
  const settings = await loadAiSettings();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-3" dir="rtl">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="font-display text-xl font-extrabold">إعدادات النظام</h1>
        <span className="text-xs text-muted-foreground">ضوابط عامة تُفرض من الخادم على كامل سير النشر</span>
      </div>
      <SystemSettingsClient initial={settings.governance} canEdit={gate.actor.can("ai.settings")} />
    </main>
  );
}
