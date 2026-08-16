"use client";

/**
 * مكون تفريغ وعزل الصور بالذكاء البصري التلقائي (True Alpha Transparent Cutout)
 * يقوم بفحص الصورة النقطية وحذف أي خلفيات مربعة (سوداء، رمادية، شطرنج، أو مصمتة)
 * وتحويلها فورياً إلى صورة مفرغة نقية 100% (Alpha Channel) تطفو بحرية فوق البطاقات.
 */

import { useEffect, useRef, useState } from "react";

interface TransparentCutoutProps {
  src: string;
  alt: string;
  className?: string;
  glowColor?: string;
}

export function TransparentCutout({ src, alt, className = "", glowColor }: TransparentCutoutProps) {
  const [processedSrc, setProcessedSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!src) return;

    let isMounted = true;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;

    img.onload = () => {
      if (!isMounted) return;

      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          setProcessedSrc(src);
          setLoading(false);
          return;
        }

        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        const width = canvas.width;
        const height = canvas.height;

        // فحص عينات زوايا الصورة لمعرفة لون الخلفية
        const cornerSamples: Array<[number, number, number]> = [];
        const sampleCoords = [
          [2, 2],
          [width - 3, 2],
          [2, height - 3],
          [width - 3, height - 3],
          [Math.floor(width / 2), 2],
          [2, Math.floor(height / 2)],
          [width - 3, Math.floor(height / 2)],
          [Math.floor(width / 2), height - 3],
        ];

        for (const [x, y] of sampleCoords) {
          const idx = (y * width + x) * 4;
          cornerSamples.push([data[idx], data[idx + 1], data[idx + 2]]);
        }

        // متوسط سطوع زوايا الخلفية
        const avgCornerBrightness =
          cornerSamples.reduce((sum, [r, g, b]) => sum + (0.299 * r + 0.587 * g + 0.114 * b), 0) /
          cornerSamples.length;

        const isDarkBackground = avgCornerBrightness < 75;
        const isCheckerboardOrLight = avgCornerBrightness > 160;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

          if (isDarkBackground) {
            // تفريغ الخلفيات السوداء والداكنة تماماً
            if (brightness < 28) {
              data[i + 3] = 0; // تفريغ تام
            } else if (brightness < 60) {
              // تلاشي حواف ناعم ومضاد للتشوه (Antialiasing)
              const factor = (brightness - 28) / 32;
              data[i + 3] = Math.round(data[i + 3] * factor);
            }
          } else if (isCheckerboardOrLight) {
            // تفريغ الخلفيات الفاتحة أو مربعات الشطرنج الوهمية
            const colorDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
            if (colorDiff < 18 && brightness > 140) {
              data[i + 3] = 0; // إزالة مربعات الشطرنج الرمادية والبيضاء
            } else if (colorDiff < 25 && brightness > 110) {
              const factor = (140 - brightness) / 30;
              data[i + 3] = Math.max(0, Math.min(255, Math.round(data[i + 3] * factor)));
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);
        const outputUrl = canvas.toDataURL("image/png");
        setProcessedSrc(outputUrl);
      } catch (err) {
        console.warn("Canvas cutout processing fallback:", err);
        setProcessedSrc(src);
      } finally {
        setLoading(false);
      }
    };

    img.onerror = () => {
      if (isMounted) {
        setProcessedSrc(src);
        setLoading(false);
      }
    };

    return () => {
      isMounted = false;
    };
  }, [src]);

  return (
    <div className="relative w-full h-36 sm:h-40 flex items-center justify-center overflow-visible">
      {/* هالة التوهج المائية الحيوية خلف الكائن */}
      {glowColor && (
        <div
          className="absolute w-28 h-28 rounded-full pointer-events-none transition-transform duration-500 group-hover:scale-125"
          style={{
            background: glowColor,
            filter: "blur(32px)",
            opacity: 0.45,
          }}
        />
      )}

      {/* الصورة المفرغة بنقاء ألفا تطفو بدون أي مستطيل أو زوايا */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={processedSrc || src}
        alt={alt}
        className={`max-w-[88%] max-h-36 object-contain relative z-10 drop-shadow-[0_16px_28px_rgba(0,0,0,0.8)] transition-all duration-500 group-hover:scale-110 ${className} ${
          loading ? "opacity-0" : "opacity-100"
        }`}
        style={{
          filter: "drop-shadow(0 14px 24px rgba(0,0,0,0.85)) drop-shadow(0 0 12px rgba(34,211,238,0.25))",
        }}
      />
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}
