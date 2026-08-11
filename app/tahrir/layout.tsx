import type { Metadata } from "next";

import "./tahrir.css";

export const metadata: Metadata = {
  title: { default: "تحرير العلم", template: "%s | تحرير العلم" },
  robots: { index: false, follow: false },
};

export default function TahrirLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="th">{children}</div>;
}
