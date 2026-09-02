"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

/** الأيقونتان معًا ويحسم CSS الظاهرة منهما — فلا حاجة لحالة «mounted» ولا لتباين ترطيب. */
export function ThemeSwitch() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label="تبديل الوضع الفاتح والداكن"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <MoonIcon className="dark:hidden" />
      <SunIcon className="hidden dark:block" />
    </Button>
  );
}
