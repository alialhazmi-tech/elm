/** لوقو العلم الرسمي — صورة بيضاء تُلوَّن بالحبر في الوضع الفاتح. */

const SRC = {
  wordmark: "/brand/alelm-wordmark.png",
  lockup: "/brand/alelm-lockup.png",
} as const;

type BrandMarkProps = {
  variant?: keyof typeof SRC;
  className?: string;
};

export function BrandMark({ variant = "wordmark", className }: BrandMarkProps) {
  return (
    <span className={["brand-mark", `brand-mark-${variant}`, className].filter(Boolean).join(" ")}>
      <img src={SRC[variant]} alt="" />
    </span>
  );
}
