"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { publicToolPage, registerPublicBrowserTools, type BrowserModelContext } from "@/lib/agents/webmcp";
import { GooglePageviews } from "./google-pageviews";

/** Share one invisible client boundary without changing pageview behavior. */
export function PublicPageEffects() {
  const pathname = usePathname();
  useEffect(() => {
    if (!publicToolPage(pathname)) return;
    const context = (document as Document & { modelContext?: BrowserModelContext }).modelContext
      ?? (navigator as Navigator & { modelContext?: BrowserModelContext }).modelContext;
    if (typeof context?.registerTool !== "function") return;
    return registerPublicBrowserTools(context);
  }, [pathname]);
  return <GooglePageviews />;
}
