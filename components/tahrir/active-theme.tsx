"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import {
  DEFAULT_THEME,
  TAHRIR_ROOT_ID,
  THEME_ATTRIBUTE_NAMES,
  themeCookieName,
  themeDataAttributes,
  type ThemeConfig,
} from "@/lib/tahrir/themes";

type ThemeContextValue = {
  theme: ThemeConfig;
  setTheme: (theme: ThemeConfig) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function writeCookie(name: string, value: string | null) {
  const secure = window.location.protocol === "https:" ? "Secure;" : "";
  document.cookie = value
    ? `${name}=${value}; path=/tahrir; max-age=31536000; SameSite=Lax; ${secure}`
    : `${name}=; path=/tahrir; max-age=0; SameSite=Lax; ${secure}`;
}

/**
 * يطبّق سمات data-theme-* على الغلاف (رُسمت على الخادم أصلًا) وعلى <html> حتى تصل الرموز
 * إلى بوابات Radix خارج الغلاف، ويحفظ الاختيار في كوكيز يقرؤها الخادم قبل الرسم التالي.
 * عند مغادرة اللوحة تُزال سمات <html> فلا تلامس رموز الموقع العام.
 */
export function ActiveThemeProvider({
  children,
  initialTheme,
}: {
  children: ReactNode;
  initialTheme?: ThemeConfig;
}) {
  const [theme, setTheme] = useState<ThemeConfig>(() => initialTheme ?? { ...DEFAULT_THEME });

  useEffect(() => {
    const attributes = themeDataAttributes(theme);
    const targets = [document.documentElement, document.getElementById(TAHRIR_ROOT_ID)];
    for (const target of targets) {
      if (!target) continue;
      for (const name of THEME_ATTRIBUTE_NAMES) {
        const value = attributes[name];
        if (value) target.setAttribute(name, value);
        else target.removeAttribute(name);
      }
    }
    for (const key of Object.keys(DEFAULT_THEME) as Array<keyof ThemeConfig>) {
      writeCookie(themeCookieName(key), theme[key] === DEFAULT_THEME[key] ? null : theme[key]);
    }
  }, [theme]);

  useEffect(() => {
    return () => {
      for (const name of THEME_ATTRIBUTE_NAMES) document.documentElement.removeAttribute(name);
    };
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useThemeConfig(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useThemeConfig يعمل داخل ActiveThemeProvider فقط");
  return context;
}
