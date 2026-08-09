/** بنود 10–13: الإنفوجرافيك والفيديوجرافيك، النص المصاحب، الصور، المحتوى الإعلاني. */

import type { Finding, Rule } from "../types.ts";
import { countWords } from "../normalize.ts";
import {
  BLOCKING_MEDIA_FLAGS,
  INFOGRAPHIC_LIMITS,
  SOCIAL_LIMITS,
  VIDEOGRAPHIC_LIMITS,
  WARNING_MEDIA_FLAGS,
} from "../dictionary.ts";
import { makeFinding } from "./shared.ts";

const MEDIA_FLAG_LABELS: Record<string, string> = {
  gore: "جثث أو مناظر دامية",
  "competitor-logo": "شعار وكالة أو وسيلة إعلام منافسة",
  "zionist-flag": "علم الكيان الصهيوني",
  "religious-values": "مخالفة لتعاليم الدين الإسلامي أو قيم المجتمع",
  "personal-handle": "حساب أو توقيع شخصي ظاهر",
  "social-watermark": "عنوان منصة تواصل ظاهر على الصورة",
};

const infographic: Rule = {
  id: "INFOGRAPHIC-LIMITS",
  category: "graphics",
  severity: "warning",
  policyRef: "الدستور التحريري § 10",
  title: "ضوابط كتابة الإنفوجرافيك",
  run(draft) {
    const spec = draft.infographic;
    if (!spec) return [];

    const findings: Finding[] = [];
    const introWords = spec.intro ? countWords(spec.intro) : 0;

    if (spec.intro && introWords > INFOGRAPHIC_LIMITS.introMaxWords) {
      findings.push(
        makeFinding(infographic, {
          field: "infographic.intro",
          message: `مقدمة الإنفوجرافيك ${introWords} كلمة، والحد ${INFOGRAPHIC_LIMITS.introMaxWords} كلمة.`,
        }),
      );
    }

    spec.points.forEach((point, index) => {
      const words = countWords(point);
      if (words > INFOGRAPHIC_LIMITS.pointMaxWords) {
        findings.push(
          makeFinding(infographic, {
            field: `infographic.points[${index}]`,
            message: `النقطة ${words} كلمة، والحد الأقصى ${INFOGRAPHIC_LIMITS.pointMaxWords} كلمات.`,
            excerpt: point,
          }),
        );
      }
    });

    if (spec.points.length > INFOGRAPHIC_LIMITS.maxPoints) {
      findings.push(
        makeFinding(infographic, {
          field: "infographic.points",
          message: `عدد النقاط ${spec.points.length}، والحد ${INFOGRAPHIC_LIMITS.maxPoints}. الوثيقة تنص على تقسيم المحتوى إلى مادتين عند الزيادة.`,
        }),
      );
    } else if (spec.points.length > 0 && spec.points.length < INFOGRAPHIC_LIMITS.minPoints) {
      findings.push(
        makeFinding(infographic, {
          field: "infographic.points",
          message: `عدد النقاط ${spec.points.length}، والنطاق المعتمد ${INFOGRAPHIC_LIMITS.minPoints}–${INFOGRAPHIC_LIMITS.maxPoints}.`,
        }),
      );
    }

    return findings;
  },
};

const videographic: Rule = {
  id: "VIDEOGRAPHIC-LIMITS",
  category: "graphics",
  severity: "warning",
  policyRef: "الدستور التحريري § 10",
  title: "ضوابط كتابة الفيديوجرافيك",
  run(draft) {
    const spec = draft.videographic;
    if (!spec) return [];

    const findings: Finding[] = [];

    if (spec.scenes.length < VIDEOGRAPHIC_LIMITS.minScenes || spec.scenes.length > VIDEOGRAPHIC_LIMITS.maxScenes) {
      findings.push(
        makeFinding(videographic, {
          field: "videographic.scenes",
          message: `عدد المشاهد ${spec.scenes.length}، والنطاق المعتمد ${VIDEOGRAPHIC_LIMITS.minScenes}–${VIDEOGRAPHIC_LIMITS.maxScenes} مشهدًا.`,
        }),
      );
    }

    spec.scenes.forEach((scene, index) => {
      const words = countWords(scene);
      if (words < VIDEOGRAPHIC_LIMITS.sceneMinWords || words > VIDEOGRAPHIC_LIMITS.sceneMaxWords) {
        findings.push(
          makeFinding(videographic, {
            field: `videographic.scenes[${index}]`,
            message: `المشهد ${words} كلمة، والنطاق المعتمد ${VIDEOGRAPHIC_LIMITS.sceneMinWords}–${VIDEOGRAPHIC_LIMITS.sceneMaxWords} كلمات.`,
            excerpt: scene,
          }),
        );
      }
    });

    if (spec.intro && !spec.intro.includes("؟") && !spec.intro.includes("?")) {
      findings.push({
        ...makeFinding(videographic, {
          field: "videographic.intro",
          message: "يُفضل أن تبدأ المقدمة بسؤال لإثارة ذهن المتلقي.",
        }),
        severity: "suggestion",
      });
    }

    if (spec.outro && !spec.outro.includes("؟") && !spec.outro.includes("?")) {
      findings.push({
        ...makeFinding(videographic, {
          field: "videographic.outro",
          message: "يُفضل أن تنتهي الخاتمة بسؤال تفاعلي.",
        }),
        severity: "suggestion",
      });
    }

    return findings;
  },
};

const socialCaptions: Rule = {
  id: "SOCIAL-CAPTION-LIMITS",
  category: "social",
  severity: "warning",
  policyRef: "الدستور التحريري § 11",
  title: "حدود النص المصاحب لكل منصة",
  run(draft) {
    return (draft.social ?? []).flatMap((caption, index) => {
      const limits = SOCIAL_LIMITS[caption.platform];
      const findings: Finding[] = [];
      const words = countWords(caption.text);
      const hashtags = caption.hashtags ?? [];

      if (words > limits.maxWords) {
        findings.push(
          makeFinding(socialCaptions, {
            field: `social[${index}].text`,
            message: `النص المصاحب ${words} كلمة، وحد ${caption.platform} هو ${limits.maxWords} كلمة.`,
            excerpt: caption.text,
          }),
        );
      }

      if (caption.platform === "twitter" && hashtags.length > 0) {
        findings.push(
          makeFinding(socialCaptions, {
            field: `social[${index}].hashtags`,
            message: "لا تُضاف هاشتاقات على تويتر إلا إذا كانت منتشرة ومتداولة فعلًا — أكّد ذلك قبل النشر.",
            needsHumanReview: true,
          }),
        );
      } else if (hashtags.length > limits.maxHashtags) {
        findings.push(
          makeFinding(socialCaptions, {
            field: `social[${index}].hashtags`,
            message: `عدد الهاشتاقات ${hashtags.length}، والحد على ${caption.platform} هو ${limits.maxHashtags}.`,
          }),
        );
      }

      return findings;
    });
  },
};

const mediaCompliance: Rule = {
  id: "MEDIA-COMPLIANCE",
  category: "media",
  severity: "blocking",
  policyRef: "الدستور التحريري § 12",
  title: "حقوق الصور ومحظورات النشر",
  run(draft) {
    return (draft.media ?? []).flatMap((asset, index) => {
      const findings: Finding[] = [];
      const field = `media[${index}]`;

      if (asset.rightsCleared !== true) {
        findings.push(
          makeFinding(mediaCompliance, {
            field,
            message: "حقوق الملكية الفكرية للصورة غير موثقة في مكتبة الوسائط. لا نشر قبل توثيقها.",
            excerpt: asset.url,
          }),
        );
      }

      for (const flag of asset.flags ?? []) {
        const label = MEDIA_FLAG_LABELS[flag] ?? flag;

        if (BLOCKING_MEDIA_FLAGS.some((blocked) => blocked === flag)) {
          findings.push(
            makeFinding(mediaCompliance, {
              field,
              message: `الصورة تحمل «${label}» — النشر ممنوع وفق معايير نشر الصور.`,
              excerpt: asset.url,
            }),
          );
        } else if (WARNING_MEDIA_FLAGS.some((warned) => warned === flag)) {
          findings.push({
            ...makeFinding(mediaCompliance, {
              field,
              message: `الصورة تحمل «${label}» — تلزم معالجتها أو استبدالها قبل الاعتماد.`,
              excerpt: asset.url,
            }),
            severity: "warning",
          });
        }
      }

      if (asset.personName) {
        findings.push({
          ...makeFinding(mediaCompliance, {
            field,
            message: `أكّد تطابق الصورة مع «${asset.personName}» — مسؤولية صحة الصورة وارتباطها بالشخصية على مدير التحرير.`,
            needsHumanReview: true,
          }),
          severity: "warning",
        });
      }

      return findings;
    });
  },
};

const advertising: Rule = {
  id: "AD-CONTROLS",
  category: "advertising",
  severity: "warning",
  policyRef: "الدستور التحريري § 13",
  title: "ضوابط المحتوى الإعلاني",
  run(draft) {
    if (!draft.paidPromotion) return [];

    return [
      makeFinding(advertising, {
        field: "paidPromotion",
        message:
          "مادة إعلانية: تحقق من تراخيص الجهة الحكومية للسلعة أو الخدمة، وأبلغ فريق التحرير بوجودها، ولمدير التحرير حق إعادة الصياغة.",
        needsHumanReview: true,
      }),
    ];
  },
};

export const productionRules: Rule[] = [
  infographic,
  videographic,
  socialCaptions,
  mediaCompliance,
  advertising,
];
