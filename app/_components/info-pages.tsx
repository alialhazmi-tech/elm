import Link from "next/link";
import type { ReactNode } from "react";

import "./info-pages.css";

/**
 * لبنات الصفحات التعريفية الثلاث: من نحن، والذكاء الاصطناعي في العلم، وسياسة الخصوصية.
 * الشرارة الزعفرانية علامة ما يولّده الذكاء الاصطناعي، والقلم الكحلي علامة ما يراجعه المحرر،
 * وتتكرران في الصفحات الثلاث بالمعنى نفسه.
 */

type IconProps = { className?: string };

const PATHS = {
  spark: <path fill="currentColor" d="M12 1.5c.9 6.6 3.9 9.6 10.5 10.5-6.6.9-9.6 3.9-10.5 10.5C11.1 15.9 8.1 12.9 1.5 12 8.1 11.1 11.1 8.1 12 1.5Z" />,
  pen: <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Zm10.5-12.5 3 3" />,
  check: <path fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" d="M5 12.5l4.5 4.5L19 7.5" />,
  arrow: <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m6-6-6 6 6 6" />,
  alert: <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 3 2 20h20L12 3Zm0 6v5m0 3v.5" />,
  info: <><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" /><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M12 11v6M12 7.5v.5" /></>,
  lock: <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3" />,
  sliders: <><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M4 7h10m4 0h2M4 17h4m4 0h8" /><circle cx="16" cy="7" r="2" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="10" cy="17" r="2" fill="none" stroke="currentColor" strokeWidth="2" /></>,
  mail: <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" d="M3 6h18v12H3zM3 7l9 6 9-6" />,
  noSale: <><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" /><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M5.6 5.6l12.8 12.8" /></>,
  text: <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M5 5h14M5 9.5h14M5 14h14M5 18.5h8" />,
  slides: <><rect x="7" y="3" width="10" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" /><path stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M3 6v12M21 6v12" /></>,
  chart: <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M4 20h16M7 16v-5M12 16V6M17 16v-8" />,
  audio: <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" />,
  play: <path fill="currentColor" d="M19 12 7 4.5v15z" />,
} as const;

export type InfoIconName = keyof typeof PATHS;

export function InfoIcon({ name, className }: IconProps & { name: InfoIconName }) {
  return (
    <svg className={["ip-icon", className].filter(Boolean).join(" ")} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}

export const SparkMark = ({ className }: IconProps) => <InfoIcon name="spark" className={["ip-spark", className].filter(Boolean).join(" ")} />;
export const EditorMark = ({ className }: IconProps) => <InfoIcon name="pen" className={["ip-editor", className].filter(Boolean).join(" ")} />;

/** وسم «مولّد آليًا» أو «يراجعه المحرر» الصغير. */
export function ProvenanceTag({ kind, children }: { kind: "ai" | "editor"; children: ReactNode }) {
  return (
    <span className={`ip-tag ip-tag-${kind}`}>
      {kind === "ai" ? <InfoIcon name="spark" /> : <InfoIcon name="pen" />}
      {children}
    </span>
  );
}

const INFO_LINKS = [
  { href: "/about", label: "من نحن" },
  { href: "/ai", label: "الذكاء الاصطناعي في العلم", spark: true },
  { href: "/privacy-policy", label: "سياسة الخصوصية" },
  { href: "/contact", label: "تواصل معنا" },
] as const;

/** شريط التنقل بين الصفحات التعريفية. */
export function InfoNav({ current }: { current: (typeof INFO_LINKS)[number]["href"] }) {
  return (
    <nav className="ip-subnav" aria-label="عن العلم">
      {INFO_LINKS.map((link) => (
        <Link key={link.href} href={link.href} aria-current={link.href === current ? "page" : undefined}>
          {"spark" in link ? <SparkMark /> : null}
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
