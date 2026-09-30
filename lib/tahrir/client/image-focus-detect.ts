import { imageFocusFromFaces, type DetectedFace } from "@/lib/content/image-focus";

// نسخة الحزمة في مسار الملفات: scripts/copy-mediapipe-wasm.mjs ينسخها إلى public عند التثبيت.
const WASM_PATH = "/vendor/mediapipe/1.0.1/wasm";
// النموذج «بعيد المدى» يلتقط وجوه الصور الإخبارية الصغيرة (رجل أمن في لقطة واسعة) التي يفوتها القريب.
const MODEL_PATH = "/vendor/mediapipe/models/blaze_face_full_range.tflite";

type Detector = { detect(image: HTMLImageElement): { detections: Array<{ boundingBox?: { originX: number; originY: number; width: number; height: number }; categories: Array<{ score: number }> }> } };

let detector: Promise<Detector> | null = null;

/** يُحمَّل عند أول طلب فقط (~4MB مضغوطة) — لا يدخل حزمة المحرر الأولى. */
function loadDetector(): Promise<Detector> {
  detector ??= import("@mediapipe/tasks-vision")
    .then(async ({ FilesetResolver, FaceDetector }) => {
      const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
      return FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_PATH },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.5,
      });
    })
    .catch((error: unknown) => {
      // فشل التحميل (شبكة/متصفح قديم) لا يُحفظ؛ المحاولة التالية تبدأ من جديد.
      detector = null;
      throw error;
    });
  return detector;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("تعذر تحميل الصورة للتحليل."));
    image.src = src;
  });
}

/**
 * نسخة مصغرة من أصلنا عبر محسّن Next: أخف، ومن نفس الأصل فلا تمنع CORS قراءة بكسلاتها
 * (صور ووردبريس الخارجية). النسب المئوية لا تتأثر بالتصغير.
 */
function analysisSource(src: string): string {
  if (src.startsWith("blob:") || src.startsWith("data:")) return src;
  return `/_next/image?url=${encodeURIComponent(src)}&w=1080&q=75`;
}

export type FocusDetection = { focus: string | null; faces: number };

/** نقطة التركيز من الوجوه في الصورة؛ focus=null حين لا وجه موثوقًا (القص من المنتصف). */
export async function detectImageFocus(src: string): Promise<FocusDetection> {
  const [face, image] = await Promise.all([
    loadDetector(),
    loadImage(analysisSource(src)).catch(() => loadImage(src)),
  ]);
  const faces: DetectedFace[] = face.detect(image).detections.flatMap((detection) =>
    detection.boundingBox ? [{ ...detection.boundingBox, score: detection.categories[0]?.score ?? 0 }] : [],
  );
  return { focus: imageFocusFromFaces(image.naturalWidth, image.naturalHeight, faces), faces: faces.length };
}
