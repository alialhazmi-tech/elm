import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Alexandria, IBM_Plex_Sans_Arabic, Noto_Kufi_Arabic } from "next/font/google";
import "./globals.css";
import "./editorial-v2.css";
import "./soft.css";
import "./header.css";
import { PodcastDockProvider } from "@/app/_components/podcast-dock";
import { PerformanceMetrics } from "@/app/_components/performance-metrics";
import { GooglePageviews } from "@/app/_components/google-pageviews";
import { sharingMetadata, SITE_DESCRIPTION, SITE_TITLE } from "@/lib/sharing";

// العناوين بـ Alexandria، والنصوص بـ IBM Plex Sans Arabic،
// والكوفي لمسميات السلاسل. اللوقو الرسمي أصل هندسي في BrandMark.
const displayFont = Alexandria({
  subsets: ["arabic", "latin"],
  weight: ["700", "800"],
  variable: "--f-display",
  display: "swap",
});

// خط النصوص الفرعية في كل المشروع: المتون والنبذ والميتا والتسميات والأزرار.
// الأوزان الأربعة كلها مستخدمة فعليًا في الأنماط — 600 كان يقفز إلى 700 سابقًا.
const textFont = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--f-text",
  display: "swap",
});

// الكوفي: الشعار بوزن 900 ومسميات السلاسل في المسطرة بوزن 700؛ العناوين تبقى Alexandria.
const logoFont = Noto_Kufi_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["700", "800", "900"],
  variable: "--f-logo",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://alelm.net"),
  title: {
    default: "العلم | المعرفة وراء الخبر",
    template: "%s | العلم",
  },
  description: SITE_DESCRIPTION,
  applicationName: "العلم",
  authors: [{ name: "فريق تحرير العلم" }],
  creator: "العلم",
  publisher: "العلم",
  robots: { "max-image-preview": "large" },
  formatDetection: { email: false, address: false, telephone: false },
  ...sharingMetadata({ title: SITE_TITLE, description: SITE_DESCRIPTION, path: "/" }),
  icons: {
    icon: [
      { url: "/brand/alelm-icon.png", type: "image/png", sizes: "64x64" },
      { url: "/favicon.svg" },
    ],
    shortcut: "/brand/alelm-icon.png",
    apple: "/brand/alelm-icon.png",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1322" },
  ],
};

/** يقرأ تفضيل الثيم المحفوظ قبل الرسم الأول لمنع وميض التبديل. */
const themeInit = `(function(){try{var t=localStorage.getItem("alelm-theme");if(t==="dark"||t==="light"){document.documentElement.dataset.theme=t}}catch(e){}})()`;

const tagManagerInit = `(function(w,d,s,l,i){if(w.location.pathname.replace(/\\/$/,'')==='/join/reset'||w.location.pathname.replace(/\\/$/,'')==='/tahrir/recover')return;w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-MLB68TX2');`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      data-scroll-behavior="smooth"
      className={`${displayFont.variable} ${textFont.variable} ${logoFont.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script id="google-tag-manager" dangerouslySetInnerHTML={{ __html: tagManagerInit }} />
      </head>
      <body>
        <noscript>
          <iframe
            title="Google Tag Manager"
            src="https://www.googletagmanager.com/ns.html?id=GTM-MLB68TX2"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <PodcastDockProvider>{children}</PodcastDockProvider>
        <Suspense fallback={null}><PerformanceMetrics /></Suspense>
        <Suspense fallback={null}><GooglePageviews /></Suspense>
      </body>
    </html>
  );
}
