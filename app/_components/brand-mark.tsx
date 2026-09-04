/** الشعار الأبيض المعتمد للهيدر، مع النسخ السابقة للمواضع الأخرى. */

const SRC = {
  official: "/brand/alelm-logo-light.png",
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
      <img src={SRC[variant]} alt="" {...(variant === "official" ? { width: 676, height: 364 } : {})} />
    </span>
  );
}
