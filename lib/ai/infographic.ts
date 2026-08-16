/**
 * محرك الذكاء الاصطناعي لتوليد الإنفوجرافيك التفاعلي — من النص الخام إلى تجربة بصرية متحركة.
 */

import Anthropic from "@anthropic-ai/sdk";

import { runPolicyGuard } from "../policy/index.ts";
import {
  INFOGRAPHIC_THEMES,
  THEME_CONFIGS,
  type InfographicData,
  type InfographicThemeId,
} from "./infographic-types.ts";
import type { AiSettingsData } from "./settings.ts";

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return apiKey ? new Anthropic({ apiKey }) : null;
}

const ARABIC_DIGITS = /[٠-٩]/g;
const toLatinDigits = (text: string) =>
  text.replace(ARABIC_DIGITS, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));

export function extractNumbersFromText(text: string): string[] {
  const normalized = toLatinDigits(text).replace(/(\d)[,،٬](\d{3})/g, "$1$2");
  return normalized.match(/\d+(?:\.\d+)?/g) ?? [];
}

/** نموذج افتراضي متكامل لاقتصاد المدّ الأزرق كمرجع وقالب أصلي */
export function getBlueEconomyPreset(): InfographicData {
  return {
    id: "blue-economy-ksa",
    title: "اقتصاد المدّ الأزرق",
    eyebrow: "رؤية المملكة 2030 · الثروة السمكية",
    kicker: "استدامة واستثمار",
    subtitle: "آفاق استثمار المصائد ومزارع الأحياء المائية في المملكة",
    introText:
      "تعد المملكة مركزًا واعدًا للاستثمار في الاستزراع المائي وصيد الأسماك بفضل سواحلها الممتدة على البحر الأحمر والخليج العربي، مما يعزز الأمن الغذائي والتنويع الاقتصادي.",
    themeId: "ocean-cyber",
    hero: {
      badge: "المبادرة الوطنية لتطوير الثروة السمكية",
      mapHighlight: "سواحل البحر الأحمر والخليج العربي",
      bgPrompt:
        "Cinematic futuristic 3D aerial view of glowing circular fish farm cages in deep navy ocean waters at sunset, neon cyan grid lines connecting to Saudi Arabia coastal outline, photorealistic, 8k resolution, volumetric lighting.",
      bgImageUrl: "",
    },
    macroSection: {
      title: "صيد وحصاد وفير",
      stats: [
        {
          id: "stat-1",
          value: 289.9,
          suffix: "ألف طن",
          label: "المصايد ومزارع الأحياء المائية في 2024",
          trend: "+19% نمو سنوي",
          isPositive: true,
        },
        {
          id: "stat-2",
          value: 192.4,
          suffix: "ألف طن",
          label: "صيد مزارع الأحياء المائية",
          sublabel: "الاستزراع في المياه الداخلية والبحرية",
        },
        {
          id: "stat-3",
          value: 97.6,
          suffix: "ألف طن",
          label: "شبكات الصيد بالمياه الإقليمية",
          sublabel: "الصيد التقليدي والتجاري",
        },
      ],
      bannerPrompt:
        "Cinematic panoramic view of modern fishing trawlers navigating deep blue waters near futuristic Saudi seaport at golden hour sunrise, high contrast, ultra detailed.",
    },
    showcaseSection: {
      title: "الإنتاج متنوّع",
      subtitle: "توزيع حصاد الأحياء المائية حسب الأنواع الأكثر وفرة وقيمة",
      items: [
        {
          id: "fish-1",
          name: "الروبيان الأبيض",
          category: "قشريات بحرية",
          statValue: 86.8,
          statSuffix: "ألف طن",
          description: "أكبر مساهم في صادرات الاستزراع المائي إلى الأسواق العالمية.",
          imagePrompt:
            "Single centered white tiger prawn shrimp on solid pitch black background (#000000), intense studio rim lighting, pure black void, no shadows, no floor, no checkerboard, ultra sharp 8k detail.",
          floatSpeedSeconds: 4,
          tags: ["صادرات", "مياه مالحة"],
        },
        {
          id: "fish-2",
          name: "أسماك بحرية (سيباس ودنيس)",
          category: "أسماك زعانف",
          statValue: 71.2,
          statSuffix: "ألف طن",
          description: "إنتاج الأقفاص العائمة في البحر الأحمر بجودة غذائية فائقة.",
          imagePrompt:
            "Single European seabass fish swimming sideways on solid pitch black background (#000000), iridescent scales, cinematic underwater rim light, no shadows, 8k.",
          floatSpeedSeconds: 5,
          tags: ["أقفاص عائمة", "أمن غذائي"],
        },
        {
          id: "fish-3",
          name: "سمك السيباس",
          category: "استزراع مائي",
          statValue: 18.8,
          statSuffix: "ألف طن",
          description: "نمو متسارع في مشاريع الساحل الغربي.",
          imagePrompt:
            "Single silver sea bass fish on solid pitch black background (#000000), side profile, clear fins, vibrant details, pure black background, 8k.",
          floatSpeedSeconds: 4.5,
        },
        {
          id: "fish-4",
          name: "سمك الهامور والناجل",
          category: "صيد طبيعي واستزراع",
          statValue: 10.1,
          statSuffix: "ألف طن",
          description: "الأسماك الأكثر طلباً في السوق المحلي الخليجي.",
          imagePrompt:
            "Single spotted brown grouper hamour fish on solid pitch black background (#000000), detailed marine textures, studio rim lighting, pure black background, 8k.",
          floatSpeedSeconds: 6,
        },
        {
          id: "fish-5",
          name: "سمك البلطي",
          category: "مياه عذبة",
          statValue: 7.6,
          statSuffix: "ألف طن",
          description: "إنتاج المزارع الداخلية في مختلف مناطق المملكة.",
          imagePrompt:
            "Single freshwater tilapia fish on solid pitch black background (#000000), sharp side view, natural coloration, pure black background, 8k.",
          floatSpeedSeconds: 5.5,
        },
      ],
    },
    operationsSection: {
      title: "شباك في كل جهة",
      subtitle: "البنية التحتية والأسطول البحري الممتد على سواحل المملكة",
      blocks: [
        {
          id: "op-1",
          title: "مراكب الصيد المرخصة",
          value: "61.4 ألف",
          label: "قارب ومركب صيد نشط",
          badge: "أسطول وطني",
        },
        {
          id: "op-2",
          title: "مرافئ وموانئ الصيد",
          value: "16.8 ألف",
          label: "مرفأ وقرية صيد مجهزة",
          badge: "بنية تحتية",
        },
        {
          id: "op-3",
          title: "حجم التغطية الساحلية",
          value: "93.85%",
          label: "من المياه الإقليمية مستفاد منها",
        },
        {
          id: "op-4",
          title: "تراخيص الصيادين الحرفيين",
          value: "36.2 ألف",
          label: "صياد حرفي ومهني مسجل",
        },
      ],
    },
    impactSection: {
      title: "قطاع يتمدّد",
      metrics: [
        {
          id: "imp-1",
          value: 180.3,
          suffix: "مليون ريال",
          label: "حجم الواردات المعوضة محلياً",
        },
        {
          id: "imp-2",
          value: 49.4,
          suffix: "ألف",
          label: "إجمالي الوظائف المباشرة وغير المباشرة",
        },
        {
          id: "imp-3",
          value: 4,
          suffix: "مليار ريال",
          label: "استثمارات البنية التحتية والاستزراع المائي",
        },
        {
          id: "imp-4",
          value: 4485,
          suffix: "",
          label: "قارب صيد حديث تم دعمه بالتمكين التقني",
        },
      ],
      footerNote: "مصدر البيانات: وزارة البيئة والمياه والزراعة والهيئة العامة للإحصاء.",
    },
    visionSection: {
      title: "الرؤية تقود النمو",
      targetYear: 2030,
      subtitle: "مستهدفات طموحة لمضاعفة الإنتاج وتحقيق الاكتفاء الذاتي والتصدير العالمي",
      targets: [
        {
          id: "vis-1",
          label: "مستهدف الإنتاج السنوي",
          currentValue: 289.9,
          targetValue: 600,
          unit: "ألف طن",
          growthMultiplier: "مضاعفة بأكثر من مرتين",
        },
        {
          id: "vis-2",
          label: "القيمة الاقتصادية المضافة",
          currentValue: 0.5,
          targetValue: 1.443,
          unit: "مليار دولار",
          growthMultiplier: "+180%",
        },
        {
          id: "vis-3",
          label: "حجم الصادرات السنوية المستهدفة",
          currentValue: 0.3,
          targetValue: 1.3,
          unit: "مليار ريال",
          growthMultiplier: "+330%",
        },
      ],
      closingStatement:
        "تمثل مستهدفات رؤية 2030 ركيزة تحول نوعي لقطاع الثروة السمكية، لترسيخ مكانة المملكة كمركز إقليمي رائد في الأمن الغذائي والابتكار البحري المستدام.",
    },
    generatedAt: new Date().toISOString(),
  };
}

export function buildDynamicInfographic(input: {
  text: string;
  topic?: string;
  preferredTheme?: InfographicThemeId;
}): InfographicData {
  const themeId: InfographicThemeId =
    input.preferredTheme && INFOGRAPHIC_THEMES.includes(input.preferredTheme)
      ? input.preferredTheme
      : "ocean-cyber";

  const title = input.topic || input.text.slice(0, 50) || "تقرير تفاعلي";
  const numbers = extractNumbersFromText(input.text);

  const preset = getBlueEconomyPreset();
  preset.id = `info-${Date.now()}`;
  preset.title = title;
  preset.themeId = themeId;
  preset.eyebrow = `رؤية المملكة 2030 · ${title}`;
  preset.introText = input.text.slice(0, 300) || preset.introText;
  preset.sourceContext = input.text.slice(0, 1000);
  preset.generatedAt = new Date().toISOString();

  if (numbers.length >= 3) {
    if (numbers[0]) preset.macroSection.stats[0].value = Number(numbers[0]) || preset.macroSection.stats[0].value;
    if (numbers[1]) preset.macroSection.stats[1].value = Number(numbers[1]) || preset.macroSection.stats[1].value;
    if (numbers[2]) preset.macroSection.stats[2].value = Number(numbers[2]) || preset.macroSection.stats[2].value;
  }

  return preset;
}

const SYSTEM_PROMPT = `أنت «خبير تصميم الإنفوجرافيك التفاعلي الذكي» لمنصة العلم الإخبارية المعرفية السعودية.
مهمتك: تحويل أي نص أو تقرير أو مسودة خبرية إلى تجربة بصرية معرفية متكاملة تشمل: العنوان العريض المكثف، النصوص التحريرية الرشيقة، الأرقام والمؤشرات الحقيقية المستخرجة بدقة، ومطالبات الصور المعزولة.

القواعد التحريرية والبصرية الإلزامية:
1) العنوان الرئيسي العريض (Title):
   - يجب أن يكون عنواناً صحفياً مكثفاً وعريضاً ومبهراً من 2 إلى 4 كلمات كحد أقصى (أمثلة: «اقتصاد المدّ الأزرق»، «ذهب الرمال»، «نبض الهيدروجين الأخضر»، «سماء المستقبل»، «طاقة الصحراء»).
   - لا تضع جملاً طويلة في العنوان الرئيسي؛ ضع التفاصيل في الشعار الفرعي (subtitle).

2) الصياغة التحريرية الرشيقة (Editorial Copy):
   - المقدمة (introText): فقرة تحريرية موجزة وذكية (30-45 كلمة) تبرز الأهمية الاستراتيجية والمكاسب الوطنية للموضوع بلغة رصينة موثقة.
   - الشعار التصنيفي (eyebrow): سطر تصنيفي موجز (مثال: «رؤية المملكة 2030 · قطاع التعدين» أو «مبادرة السعودية الخضراء · الطاقة»).

3) الأمانة الرقمية واستخراج المؤشرات (Accurate Metrics):
   - استخرج كافة الأرقام والإحصائيات والنسب الواردة في النص وضعها في أقسامها المناسبة.
   - افصل الرقم كقيمة عددية (value: 86.8) عن وحدة القياس (suffix: "ألف طن" أو "مليار ريال").
   - استخرج معدلات النمو السنوية والمقارنات (trend) إن وُجدت.

4) مطالبات الصور المعزولة ثلاثية الأبعاد (3D Isolated Prompts):
   - لكل عنصر في showcaseSection صغ مطالبة بالإنجليزية تطلب عزل العنصر منفرداً في المنتصف على خلفية سوداء نقية مع إضاءة حواف استوديو (Single centered subject on solid pitch black background #000000, intense studio rim lighting, no floor, no shadows, no checkerboard pattern, ultra sharp 8k detail).
   - لخلفية الرأس hero.bgPrompt: مشهد سينمائي بانورامي واسع وفائق الدقة بدون أي نصوص داخل الصورة.

5) اختيار السمة البصرية الأنسب (Theme):
   - ocean-cyber: للمصائد، البحار، الموانئ، والمياه.
   - desert-gold: للاقتصاد، التعدين، التراث، والاستثمار المالي.
   - cyber-emerald: للاستدامة، البيئة، الطاقة المتجددة، والزراعة.
   - midnight-tech: للذكاء الاصطناعي، الأمن السيبراني، والتقنيات العميقة.
   - royal-sapphire: للإدارة، الطيران، الفضاء، والصناعة المتقدمة.
   - crimson-energy: للنفط، الغاز، البتروكيماويات، واللوجستيات.

يجب أن يكون الرد عبارة عن كود JSON صحيح فقط يطابق المخطط التالي:
{
  "title": "...",
  "eyebrow": "...",
  "kicker": "...",
  "subtitle": "...",
  "introText": "...",
  "themeId": "ocean-cyber" | "desert-gold" | "cyber-emerald" | "midnight-tech" | "royal-sapphire" | "crimson-energy",
  "hero": {
    "badge": "...",
    "mapHighlight": "...",
    "bgPrompt": "..."
  },
  "macroSection": {
    "title": "...",
    "stats": [
      { "id": "stat-1", "value": 123.4, "suffix": "ألف طن", "label": "...", "trend": "+15%" }
    ],
    "bannerPrompt": "..."
  },
  "showcaseSection": {
    "title": "...",
    "subtitle": "...",
    "items": [
      {
        "id": "item-1",
        "name": "...",
        "category": "...",
        "statValue": 85.0,
        "statSuffix": "ألف طن",
        "description": "...",
        "imagePrompt": "...",
        "floatSpeedSeconds": 4
      }
    ]
  },
  "operationsSection": {
    "title": "...",
    "subtitle": "...",
    "blocks": [
      { "id": "op-1", "title": "...", "value": "...", "label": "...", "badge": "..." }
    ]
  },
  "impactSection": {
    "title": "...",
    "metrics": [
      { "id": "imp-1", "value": 100, "suffix": "مليون ريال", "label": "..." }
    ],
    "footerNote": "..."
  },
  "visionSection": {
    "title": "...",
    "targetYear": 2030,
    "subtitle": "...",
    "targets": [
      { "id": "vis-1", "label": "...", "currentValue": 100, "targetValue": 300, "unit": "...", "growthMultiplier": "3 أضعاف" }
    ],
    "closingStatement": "..."
  }
}`;

export async function generateInfographicPlan(
  input: {
    text: string;
    topic?: string;
    preferredTheme?: InfographicThemeId;
  },
  settings?: AiSettingsData,
): Promise<{
  infographic: InfographicData;
  usage: { model: string; inputTokens: number; outputTokens: number };
  guardFindings: Array<{ ruleId: string; severity: string; message: string }>;
}> {
  const anthropic = getClient();

  // في حال عدم توفر المفتاح نرجع نموذجاً مخصصاً مبنياً على الموضوع فورياً
  if (!anthropic) {
    return {
      infographic: buildDynamicInfographic(input),
      usage: { model: "preset-fallback", inputTokens: 0, outputTokens: 0 },
      guardFindings: [],
    };
  }

  const userMessage = `يرجى تحليل النص التالي وصياغة إنفوجرافيك تفاعلي متكامل ومبهر:
الموضوع: ${input.topic || "تحليل تقرير"}
السمة المفضلة (إن وجدت): ${input.preferredTheme || "تلقائي حسب الموضوع"}

نص التقرير / البيانات:
${input.text.slice(0, 15000)}`;

  const candidateModels = [
    settings?.models?.editorial,
    settings?.models?.fast,
    "claude-3-7-sonnet-latest",
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-latest",
    "claude-3-haiku-20240307",
  ].filter(Boolean) as string[];

  // تنظيف الأسماء غير المعتمدة
  const resolvedModels = Array.from(
    new Set(
      candidateModels.map((m) => {
        if (m === "claude-3-5-sonnet-latest" || m === "claude-sonnet-5" || m === "claude-opus-5") {
          return "claude-3-7-sonnet-latest";
        }
        if (m === "claude-haiku-4-5") {
          return "claude-3-5-haiku-latest";
        }
        return m;
      }),
    ),
  );

  const systemPrompt = settings?.tone
    ? `${SYSTEM_PROMPT}\n\nنبرة التحرير المعتمدة:\n${settings.tone}`
    : SYSTEM_PROMPT;

  let responseText = "";
  let usedModel = resolvedModels[0] || "claude-3-7-sonnet-latest";
  let usage = { inputTokens: 0, outputTokens: 0 };

  for (const modelToTry of resolvedModels) {
    try {
      const response = await anthropic.messages.create({
        model: modelToTry,
        max_tokens: 4000,
        temperature: 0.2,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      });

      const contentBlock = response.content[0];
      responseText = contentBlock.type === "text" ? contentBlock.text : "";
      usedModel = modelToTry;
      usage = {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      };
      if (responseText) break;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("not_found") || msg.includes("model")) {
        continue;
      }
      console.error(`Anthropic attempt failed on ${modelToTry}:`, err);
    }
  }

  // إذا لم نتمكن من الحصول على استجابة، نرجع نموذجاً مبنياً على النص
  if (!responseText) {
    return {
      infographic: buildDynamicInfographic(input),
      usage: { model: "fallback", inputTokens: 0, outputTokens: 0 },
      guardFindings: [],
    };
  }

  try {
    const jsonStart = responseText.indexOf("{");
    const jsonEnd = responseText.lastIndexOf("}");
    const jsonText = jsonStart !== -1 && jsonEnd !== -1 ? responseText.slice(jsonStart, jsonEnd + 1) : "";
    
    if (!jsonText) {
      throw new Error("لم يتم العثور على كائن JSON في الرد.");
    }

    const parsed = JSON.parse(jsonText) as Omit<InfographicData, "id" | "generatedAt">;

    const infographic: InfographicData = {
      ...parsed,
      id: `info-${Date.now()}`,
      themeId:
        input.preferredTheme && INFOGRAPHIC_THEMES.includes(input.preferredTheme)
          ? input.preferredTheme
          : THEME_CONFIGS[parsed.themeId]
            ? parsed.themeId
            : "ocean-cyber",
      sourceContext: input.text.slice(0, 1000),
      generatedAt: new Date().toISOString(),
    };

    // فحص النصوص بحارس السياسة
    const fullTextToCheck = [
      infographic.title,
      infographic.subtitle,
      infographic.introText,
      infographic.visionSection?.closingStatement,
    ]
      .filter(Boolean)
      .join("\n");

    const guardResult = runPolicyGuard({ title: infographic.title, body: fullTextToCheck });

    return {
      infographic,
      usage: {
        model: usedModel,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      },
      guardFindings: guardResult.findings,
    };
  } catch (parseErr) {
    console.error("JSON parse failed, falling back to dynamic structured infographic:", parseErr);
    return {
      infographic: buildDynamicInfographic(input),
      usage: { model: usedModel, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens },
      guardFindings: [],
    };
  }
}
