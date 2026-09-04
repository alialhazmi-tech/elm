import type { Metadata, Viewport } from "next";
import { Alexandria, IBM_Plex_Sans_Arabic, Noto_Kufi_Arabic } from "next/font/google";
import "./globals.css";
import "./editorial-v2.css";
import "./soft.css";
import "./header.css";
import "./home.css";
import { PodcastDockProvider } from "@/app/_components/podcast-dock";

// تصميم «المنشور»: العناوين بـ Alexandria، وكل النصوص الفرعية بـ IBM Plex Sans Arabic،
// واللوجوتايب الرسمي Noto Kufi 900 وحده.
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

// الكوفي: الشعار بوزن 900، وعناوين الرئيسية الناعمة v3 بوزني 700 و800 (home.css).
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
  description: "منصة إعلام ومعرفة سعودية تشرح ما وراء الخبر.",
  applicationName: "العلم",
  authors: [{ name: "فريق تحرير العلم" }],
  creator: "العلم",
  publisher: "العلم",
  formatDetection: { email: false, address: false, telephone: false },
  openGraph: {
    type: "website",
    locale: "ar_SA",
    siteName: "العلم",
    title: "العلم | المعرفة وراء الخبر",
    description: "منصة إعلام ومعرفة سعودية تشرح ما وراء الخبر.",
    url: "/",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "العلم - المعرفة وراء الخبر" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "العلم | المعرفة وراء الخبر",
    description: "منصة إعلام ومعرفة سعودية تشرح ما وراء الخبر.",
    images: ["/og.png"],
  },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F5F0" },
    { media: "(prefers-color-scheme: dark)", color: "#121A18" },
  ],
};

/** يقرأ تفضيل الثيم المحفوظ قبل الرسم الأول لمنع وميض التبديل. */
const themeInit = `(function(){try{var t=localStorage.getItem("alelm-theme");if(t==="dark"||t==="light"){document.documentElement.dataset.theme=t}}catch(e){}})()`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      data-scroll-behavior="smooth"
      className={`${displayFont.variable} ${textFont.variable} ${logoFont.variable}`}
      suppressHydrationWarning
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <PodcastDockProvider>{children}</PodcastDockProvider>
      </body>
    </html>
  );
}
