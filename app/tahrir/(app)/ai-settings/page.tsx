import { keyStatus, loadAiSettings } from "@/lib/ai/settings";
import { usageTotals } from "@/lib/ai/usage";
import { getSession } from "@/lib/tahrir/auth";
import { AiSettingsClient } from "../../_components/ai-settings-client";

export const metadata = { title: "إعدادات الذكاء" };
export const dynamic = "force-dynamic";

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default async function AiSettingsPage() {
  const session = await getSession();
  const [settings, totals] = await Promise.all([loadAiSettings(), usageTotals()]);
  const keys = keyStatus();

  return (
    <main className="th-screen">
      <div className="th-cols" style={{ gridTemplateColumns: "1.4fr 1fr", marginTop: 0 }}>
        <div>
          <div className="th-panel">
            <div className="hd">
              <h2>المزودون والمفاتيح</h2>
            </div>
            <div className="th-set-row">
              <div>
                <div className="sn">النصوص — Claude (Anthropic)</div>
                <div className="sd">التحرير والعناوين والتدقيق</div>
              </div>
              <span className="th-set-model">{settings.models.editorial}</span>
              <span className={`th-keychip ${keys.anthropic ? "ok" : "miss"}`}>
                {keys.anthropic ? "المفتاح مضبوط" : "أضف ANTHROPIC_API_KEY"}
              </span>
            </div>
            <div className="th-set-row">
              <div>
                <div className="sn">المهام الخفيفة — Claude Haiku</div>
                <div className="sd">التصنيف السريع — أرخص 10×</div>
              </div>
              <span className="th-set-model">{settings.models.light}</span>
              <span className={`th-keychip ${keys.anthropic ? "ok" : "miss"}`}>
                {keys.anthropic ? "المفتاح نفسه" : "المفتاح نفسه"}
              </span>
            </div>
            <div className="th-set-row">
              <div>
                <div className="sn">التحرير الشامل — Claude Sonnet</div>
                <div className="sd">أسرع من Opus لإعادة تحرير المتن، مع Haiku للحقول المساعدة</div>
              </div>
              <span className="th-set-model">{settings.models.fast}</span>
              <span className={`th-keychip ${keys.anthropic ? "ok" : "miss"}`}>
                {keys.anthropic ? "المفتاح نفسه" : "المفتاح نفسه"}
              </span>
            </div>
            <div className="th-set-row">
              <div>
                <div className="sn">الصور — مزود التوليد</div>
                <div className="sd">الأنماط الثلاثة: حقيقي/توضيحي/رسومي</div>
              </div>
              <span className="th-set-model">{settings.models.image}</span>
              <span className={`th-keychip ${keys.image ? "ok" : "miss"}`}>
                {keys.image ? "المفتاح مضبوط" : "أضف GEMINI_API_KEY"}
              </span>
            </div>
          </div>

          <AiSettingsClient initial={settings} isChief={session?.role === "chief"} />
        </div>

        <div>
          <div className="th-panel">
            <div className="hd">
              <h2>سقوف الكلفة — يوقف الخادم تجاوزها</h2>
            </div>
            <div className="th-budgetbar">
              <div className="bl">
                <span>اليوم ({totals.todayCalls} استدعاء)</span>
                <b>
                  {usd(totals.todayCents)} من ${settings.caps.dailyUsd}
                </b>
              </div>
              <div className="bb">
                <i style={{ width: `${Math.min(100, (totals.todayCents / (settings.caps.dailyUsd * 100)) * 100)}%` }} />
              </div>
            </div>
            <div className="th-budgetbar">
              <div className="bl">
                <span>الشهر</span>
                <b>
                  {usd(totals.monthCents)} من ${settings.caps.monthlyUsd}
                </b>
              </div>
              <div className="bb">
                <i style={{ width: `${Math.min(100, (totals.monthCents / (settings.caps.monthlyUsd * 100)) * 100)}%` }} />
              </div>
            </div>
          </div>

          <div className="th-panel" style={{ marginTop: 14 }}>
            <div className="hd">
              <h2>كيف يعمل النظام</h2>
            </div>
            <div className="th-rythm">
              المساعد يقترح ولا ينشر: كل مخرج يُفحص <b>بحارس السياسة</b> على الخادم قبل عرضه،
              والدستور التحريري و«نبرة العلم» يُحقنان في كل استدعاء، والإدراج بنقرة المحرر
              ويُدوَّن في <b>سجل التدقيق</b> مع كلفته. السقوف تُفرض من الخادم — عند بلوغها يتوقف
              الذكاء ولا يتوقف التحرير.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
