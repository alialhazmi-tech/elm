"use client";

/**
 * استوديو الإنفوجرافيك التفاعلي الذكي — لوحة التحكم والتحرير المباشر وتوليد الصور الحقيقية.
 * المنطق كما كان؛ الواجهة على shadcn.
 */

import { useState } from "react";
import { ImageIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";

import { InteractiveInfographic } from "@/app/_components/interactive-infographic";
import { SelectField } from "@/components/tahrir/select-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getBlueEconomyPreset } from "@/lib/ai/infographic";
import {
  INFOGRAPHIC_THEMES,
  THEME_CONFIGS,
  type InfographicData,
  type InfographicThemeId,
} from "@/lib/ai/infographic-types";

const PRESET_TOPICS = [
  {
    title: "اقتصاد المدّ الأزرق",
    theme: "ocean-cyber" as InfographicThemeId,
    desc: "المصائد ومزارع الأحياء المائية والاستزراع السمكي بالبحر الأحمر والخليج العربي.",
  },
  {
    title: "مبادرة السعودية الخضراء والطاقة المتجددة",
    theme: "cyber-emerald" as InfographicThemeId,
    desc: "زراعة 10 مليارات شجرة، الطاقة الشمسية، ومستهدفات تحييد الكربون 2060.",
  },
  {
    title: "الذكاء الاصطناعي في الرعاية الصحية",
    theme: "midnight-tech" as InfographicThemeId,
    desc: "مستشفيات المستقبل الافتراضية، التشخيص المبكر، وتقنيات الجينوم الوطنية.",
  },
  {
    title: "التعدين والصناعات المعدنية المتقدمة",
    theme: "desert-gold" as InfographicThemeId,
    desc: "استغلال الثروة المعدنية البالغة 9.4 تريليون ريال وسلاسل الإمداد الوطنية.",
  },
];

const PROVIDERS = [
  { value: "auto", label: "تلقائي (الأسرع والأدق)" },
  { value: "gemini", label: "Google Gemini / Imagen (Nano Banana Pro)" },
  { value: "openai", label: "OpenAI DALL-E 3 (GPT Images)" },
];

function PromptBlock({ title, prompt, done }: { title: string; prompt: string; done?: string | null }) {
  return (
    <div className="grid gap-1.5 rounded-lg border bg-muted/30 p-3">
      <div className="text-xs font-bold">{title}</div>
      <code dir="ltr" className="block overflow-x-auto rounded-md bg-(--sidebar) px-3 py-2 text-start font-mono text-[11px] text-(--sidebar-foreground)">
        {prompt}
      </code>
      {done ? <div className="text-[11px] font-semibold text-(--t-ok)">✓ الصورة جاهزة ومربوطة</div> : null}
    </div>
  );
}

export function InfographicStudio() {
  const [topic, setTopic] = useState("اقتصاد المدّ الأزرق");
  const [text, setText] = useState("");
  const [theme, setTheme] = useState<InfographicThemeId>("ocean-cyber");
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageProvider, setImageProvider] = useState<"auto" | "gemini" | "openai">("auto");
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [infographic, setInfographic] = useState<InfographicData>(getBlueEconomyPreset());
  const [activeTab, setActiveTab] = useState<"preview" | "editor" | "prompts" | "export">("preview");

  // توليد هيكل ونصوص الإنفوجرافيك عبر AI
  const handleGenerate = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    setStatusMsg("جارٍ تحليل النص واستخراج الأرقام وصياغة الإنفوجرافيك بالذكاء الاصطناعي...");

    try {
      const topicToSend =
        topic && topic !== "اقتصاد المدّ الأزرق"
          ? topic
          : text.trim()
            ? ""
            : topic;

      const res = await fetch("/api/tahrir/infographic/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topicToSend,
          text: text.trim() || topicToSend,
          preferredTheme: theme,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "فشل التوليد");
      }

      setInfographic(data.infographic);
      if (data.infographic.title) {
        setTopic(data.infographic.title);
      }
      if (data.infographic.themeId) {
        setTheme(data.infographic.themeId);
      }
      setStatusMsg("تم توليد الهيكل الجديد بنجاح من النص! تفقد المعاينة الحية بالأسفل.");
      setActiveTab("preview");

      setTimeout(() => {
        document.getElementById("studio-preview-section")?.scrollIntoView({ behavior: "smooth" });
      }, 150);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء التوليد");
    } finally {
      setBusy(false);
    }
  };

  // توليد الصور الحقيقية للإنفوجرافيك عبر Nano Banana (Gemini) أو GPT DALL-E
  const handleGenerateRealImages = async () => {
    if (imageBusy) return;
    setImageBusy(true);
    setError("");
    setStatusMsg("جارٍ توليد الصور الحقيقية بالذكاء الاصطناعي (قد يستغرق 10-20 ثانية)...");

    try {
      const res = await fetch("/api/tahrir/infographic/generate-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          infographic,
          provider: imageProvider,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "فشل توليد الصور");
      }

      setInfographic(data.infographic);
      setStatusMsg("تم توليد وربط الصور الحقيقية بنجاح! تفقد المعاينة الحية.");
      setActiveTab("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر توليد الصور");
    } finally {
      setImageBusy(false);
    }
  };

  const handleSelectPreset = (p: typeof PRESET_TOPICS[0]) => {
    setTopic(p.title);
    setText(p.desc);
    setTheme(p.theme);
  };

  return (
    <div className="flex flex-col gap-3">
      <Card className="gap-4 p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="grid gap-0.5">
            <h2 className="font-display text-[15px] font-extrabold">استوديو الإنفوجرافيك التفاعلي الذكي</h2>
            <p className="text-xs text-muted-foreground">
              أدخل أي تقرير لتوليد تجربة بصرية متحركة ومتكاملة، مع خيار توليد صور حقيقية عالية الدقة بنقرة واحدة.
            </p>
          </div>
          <span className="ms-auto inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
            <SparklesIcon className="size-3 text-primary" />
            مولّد بالذكاء
          </span>
        </div>

        <div className="grid gap-1.5">
          <span className="text-[11px] font-semibold text-muted-foreground">نماذج ومواضيع جاهزة للتجربة</span>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_TOPICS.map((p) => (
              <Button key={p.title} size="xs" variant={topic === p.title ? "default" : "outline"} onClick={() => handleSelectPreset(p)}>
                {p.title}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="ig-topic">عنوان الموضوع أو التقرير</Label>
            <Input id="ig-topic" placeholder="مثال: نمو الاستزراع المائي وصادرات الأسماك في المملكة" value={topic} onChange={(e) => setTopic(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>السمة البصرية</Label>
            <SelectField
              ariaLabel="السمة البصرية"
              value={theme}
              onValueChange={(value) => setTheme(value as InfographicThemeId)}
              options={INFOGRAPHIC_THEMES.map((tId) => ({ value: tId, label: `${THEME_CONFIGS[tId].name} (${THEME_CONFIGS[tId].category})` }))}
            />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="ig-text">نص التقرير أو البيانات التفصيلية (اختياري — يُترك فارغًا للتوليد من الموضوع مباشرة)</Label>
          <Textarea
            id="ig-text"
            rows={4}
            placeholder="الصق هنا أي نص خبري أو أرقام وإحصائيات لترجمتها تلقائيًا إلى بطاقات تفاعلية وعناصر عائمة…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3">
          <span className="text-xs font-semibold">محرك توليد الصور</span>
          <SelectField
            ariaLabel="محرك توليد الصور"
            value={imageProvider}
            onValueChange={(value) => setImageProvider(value as "auto" | "gemini" | "openai")}
            options={PROVIDERS}
            className="w-64"
          />
          <Button size="sm" variant="secondary" className="ms-auto" disabled={imageBusy} onClick={handleGenerateRealImages}>
            <ImageIcon data-icon="inline-start" />
            {imageBusy ? "جارٍ توليد الصور الحقيقية…" : "توليد صور حقيقية بالذكاء الاصطناعي"}
          </Button>
        </div>

        {statusMsg && !error ? (
          <Alert>
            <AlertDescription>✨ {statusMsg}</AlertDescription>
          </Alert>
        ) : null}
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Button className="justify-self-end font-display font-bold" disabled={busy || (!topic && !text)} onClick={handleGenerate}>
          <SparklesIcon data-icon="inline-start" />
          {busy ? "جارٍ التحليل والتوليد بالذكاء…" : "توليد وهيكلة الإنفوجرافيك"}
        </Button>
      </Card>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:grid-cols-4">
          <TabsTrigger value="preview">المعاينة الحية</TabsTrigger>
          <TabsTrigger value="editor">المحتوى والأرقام</TabsTrigger>
          <TabsTrigger value="prompts">مطالبات الصور</TabsTrigger>
          <TabsTrigger value="export">التصدير والتضمين</TabsTrigger>
        </TabsList>

        <TabsContent value="preview">
          <div id="studio-preview-section" className="overflow-hidden rounded-2xl shadow-2xl">
            <InteractiveInfographic key={infographic.id + "-" + (infographic.generatedAt || "")} data={infographic} enableControls={true} />
          </div>
        </TabsContent>

        <TabsContent value="editor">
          <Card className="gap-4 p-4">
            <h3 className="font-display text-[14px] font-bold">تعديل نصوص وبيانات الإنفوجرافيك</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="ig-title">العنوان الرئيسي</Label>
                <Input id="ig-title" value={infographic.title} onChange={(e) => setInfographic({ ...infographic, title: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ig-eyebrow">الشعار التصنيفي (Eyebrow)</Label>
                <Input id="ig-eyebrow" value={infographic.eyebrow} onChange={(e) => setInfographic({ ...infographic, eyebrow: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ig-intro">المقدمة والنبذة</Label>
              <Textarea id="ig-intro" rows={3} value={infographic.introText} onChange={(e) => setInfographic({ ...infographic, introText: e.target.value })} />
            </div>
            <h4 className="font-display text-[13px] font-bold">المؤشرات الرقمية الكبرى</h4>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {infographic.macroSection.stats.map((stat, idx) => (
                <div key={stat.id} className="grid gap-1.5 rounded-lg border bg-muted/30 p-3">
                  <Input
                    type="number"
                    step="0.1"
                    dir="ltr"
                    aria-label="القيمة"
                    className="font-display text-base font-bold"
                    value={stat.value}
                    onChange={(e) => {
                      const newStats = [...infographic.macroSection.stats];
                      newStats[idx] = { ...newStats[idx], value: Number(e.target.value) };
                      setInfographic({ ...infographic, macroSection: { ...infographic.macroSection, stats: newStats } });
                    }}
                  />
                  <Input
                    aria-label="التسمية"
                    value={stat.label}
                    onChange={(e) => {
                      const newStats = [...infographic.macroSection.stats];
                      newStats[idx] = { ...newStats[idx], label: e.target.value };
                      setInfographic({ ...infographic, macroSection: { ...infographic.macroSection, stats: newStats } });
                    }}
                  />
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="prompts">
          <Card className="gap-3 p-4">
            <div className="flex flex-wrap items-start gap-3">
              <div className="grid gap-0.5">
                <h3 className="font-display text-[14px] font-bold">مطالبات وتوليد الصور بالذكاء الاصطناعي</h3>
                <p className="text-xs text-muted-foreground">مطالبات مصممة لتوليد صور سينمائية فائقة الوضوح عبر Gemini وOpenAI.</p>
              </div>
              <Button size="sm" variant="secondary" className="ms-auto" disabled={imageBusy} onClick={handleGenerateRealImages}>
                <ImageIcon data-icon="inline-start" />
                {imageBusy ? "جارٍ التوليد…" : "توليد كافة الصور الآن"}
              </Button>
            </div>
            <PromptBlock title="1. خلفية المشهد الافتتاحي (Hero Background)" prompt={infographic.hero.bgPrompt} done={infographic.hero.bgImageUrl} />
            <PromptBlock title="2. الفاصل البانورامي (Section Divider)" prompt={infographic.macroSection.bannerPrompt || "Cinematic panoramic ocean seascape at sunset, ultra realistic."} />
            <div className="grid gap-2 rounded-lg border bg-muted/30 p-3">
              <div className="text-xs font-bold">3. العناصر العائمة ثلاثية الأبعاد (3D Floating Assets)</div>
              {infographic.showcaseSection.items.map((item) => (
                <div key={item.id} className="grid gap-1 border-s-2 border-primary ps-2">
                  <strong className="text-xs">{item.name}</strong>
                  <code dir="ltr" className="block overflow-x-auto rounded-md bg-(--sidebar) px-2 py-1.5 text-start font-mono text-[11px] text-(--sidebar-foreground)">
                    {item.imagePrompt}
                  </code>
                  {item.imageUrl ? <span className="text-[11px] font-semibold text-(--t-ok)">✓ الصورة جاهزة ومربوطة</span> : null}
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="export">
          <Card className="gap-4 p-4">
            <h3 className="font-display text-[14px] font-bold">خيارات التصدير والمشاركة</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2 rounded-lg border bg-muted/30 p-3">
                <h4 className="text-xs font-bold">كود تضمين الإنفوجرافيك (Embed)</h4>
                <p className="text-[11px] text-muted-foreground">تضمين الإنفوجرافيك التفاعلي في أي موقع أو مقال خارجي عبر iframe:</p>
                <Textarea
                  readOnly
                  dir="ltr"
                  rows={3}
                  className="font-mono text-[11px]"
                  value={`<iframe src="https://alelm.net/infographic/${infographic.id}" width="100%" height="800" frameborder="0"></iframe>`}
                />
              </div>
              <div className="grid content-start gap-2 rounded-lg border bg-muted/30 p-3">
                <h4 className="text-xs font-bold">بيانات JSON المهيكلة</h4>
                <p className="text-[11px] text-muted-foreground">نسخ كائن البيانات الكامل لاستخدامه في أنظمة إدارة المحتوى والتطبيقات:</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="justify-self-start"
                  onClick={() => {
                    void navigator.clipboard.writeText(JSON.stringify(infographic, null, 2));
                    toast.success("نُسخت بيانات JSON.");
                  }}
                >
                  نسخ بيانات JSON
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
