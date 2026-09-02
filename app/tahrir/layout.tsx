import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ThemeProvider } from "next-themes";

import "./tahrir.css";
import "./mobile.css";
import "./shadcn.css";

import { ActiveThemeProvider } from "@/components/tahrir/active-theme";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { readThemeFromCookies, TAHRIR_ROOT_ID, themeDataAttributes } from "@/lib/tahrir/themes";

export const metadata: Metadata = {
  title: { default: "تحرير العلم", template: "%s | تحرير العلم" },
  robots: { index: false, follow: false },
};

/**
 * غلاف اللوحة: next-themes يكتب data-theme على <html> بمفتاح التخزين نفسه الذي يقرؤه الموقع العام،
 * ومخصّص المظهر يقرأ إعداداته من الكوكيز هنا فتُرسم سماته على الخادم بلا وميض.
 */
export default async function TahrirLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const store = await cookies();
  const theme = readThemeFromCookies((name) => store.get(name)?.value);

  return (
    <ThemeProvider attribute="data-theme" storageKey="alelm-theme" enableSystem disableTransitionOnChange>
      <ActiveThemeProvider initialTheme={theme}>
        <TooltipProvider>
          <div id={TAHRIR_ROOT_ID} className="th group/layout" {...themeDataAttributes(theme)}>
            {children}
          </div>
          <Toaster position="top-center" richColors />
        </TooltipProvider>
      </ActiveThemeProvider>
    </ThemeProvider>
  );
}
