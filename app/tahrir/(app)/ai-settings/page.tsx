import { AiSettingsClient } from "@/components/tahrir/ai/ai-settings-client";
import { GuardChip } from "@/components/tahrir/badges";
import { Panel } from "@/components/tahrir/overview/panel";
import { Progress } from "@/components/ui/progress";
import { keyStatus, loadAiSettings } from "@/lib/ai/settings";
import { usageTotals } from "@/lib/ai/usage";
import { loadActor } from "@/lib/tahrir/access";

export const metadata = { title: "إعدادات الذكاء" };
export const dynamic = "force-dynamic";

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default async function AiSettingsPage() {
  const actor = await loadActor();
  const [settings, totals] = await Promise.all([loadAiSettings(), usageTotals()]);
  const keys = keyStatus();
  const providers: Array<[string, string, string, boolean, string]> = [
    ["النصوص — Claude (Anthropic)", "التحرير والعناوين والتدقيق", settings.models.editorial, keys.anthropic, "ANTHROPIC_API_KEY"],
    ["المهام الخفيفة — Claude Haiku", "التصنيف السريع — أرخص 10×", settings.models.light, keys.anthropic, "ANTHROPIC_API_KEY"],
    ["التحرير الشامل — Claude Sonnet", "أسرع من Opus لإعادة تحرير المتن، مع Haiku للحقول المساعدة", settings.models.fast, keys.anthropic, "ANTHROPIC_API_KEY"],
    ["الصور — مزود التوليد", "الأنماط الثلاثة: حقيقي/توضيحي/رسومي", settings.models.image, keys.image, "GEMINI_API_KEY"],
  ];
  const dayPct = Math.min(100, (totals.todayCents / (settings.caps.dailyUsd * 100)) * 100);
  const monthPct = Math.min(100, (totals.monthCents / (settings.caps.monthlyUsd * 100)) * 100);

  return (
    <main className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="font-display text-xl font-extrabold">إعدادات الذكاء</h1>
        <span className="text-xs text-muted-foreground">المزودون والأدوات والسقوف — التعديل قرار رئيس التحرير</span>
      </div>
      <div className="grid items-start gap-3 lg:grid-cols-[1.4fr_1fr]">
        <div className="grid gap-3">
          <Panel title="المزودون والمفاتيح">
            {providers.map(([name, desc, model, ready, envKey]) => (
              <div key={name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b px-4 py-2.5 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                <div className="min-w-0">
                  <div className="text-[12.5px] font-semibold">{name}</div>
                  <div className="text-[11px] text-muted-foreground">{desc}</div>
                </div>
                <code className="hidden rounded bg-muted px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground sm:inline" dir="ltr">
                  {model}
                </code>
                <GuardChip tone={ready ? "ok" : "block"} label={ready ? "المفتاح مضبوط" : `أضف ${envKey}`} />
              </div>
            ))}
          </Panel>
          <AiSettingsClient initial={settings} isChief={actor?.can("ai.settings") ?? false} />
        </div>
        <div className="grid gap-3">
          <Panel title="سقوف الكلفة — يوقف الخادم تجاوزها">
            <div className="grid gap-4 p-4">
              <div className="grid gap-1.5">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-muted-foreground">اليوم ({totals.todayCalls} استدعاء)</span>
                  <b className="tabular-nums" dir="ltr">
                    {usd(totals.todayCents)} / ${settings.caps.dailyUsd}
                  </b>
                </div>
                <Progress value={dayPct} aria-label="استهلاك اليوم" />
              </div>
              <div className="grid gap-1.5">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-muted-foreground">الشهر</span>
                  <b className="tabular-nums" dir="ltr">
                    {usd(totals.monthCents)} / ${settings.caps.monthlyUsd}
                  </b>
                </div>
                <Progress value={monthPct} aria-label="استهلاك الشهر" />
              </div>
            </div>
          </Panel>
          <Panel title="كيف يعمل النظام">
            <p className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">
              المساعد يقترح ولا ينشر: كل مخرج يُفحص <b className="text-foreground">بحارس السياسة</b> على الخادم قبل عرضه، والدستور
              التحريري و«نبرة العلم» يُحقنان في كل استدعاء، والإدراج بنقرة المحرر ويُدوَّن في{" "}
              <b className="text-foreground">سجل التدقيق</b> مع كلفته. السقوف تُفرض من الخادم — عند بلوغها يتوقف الذكاء ولا يتوقف
              التحرير.
            </p>
          </Panel>
        </div>
      </div>
    </main>
  );
}
