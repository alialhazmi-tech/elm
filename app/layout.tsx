import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, Noto_Kufi_Arabic } from "next/font/google";
import "./globals.css";

// الخطوط الرسمية من دليل الهوية: Noto Kufi للعناوين والشعار، IBM Plex للمتون.
const displayFont = Noto_Kufi_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["600", "700", "800", "900"],
  variable: "--f-display",
  display: "swap",
});

const textFont = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--f-text",
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
    { media: "(prefers-color-scheme: light)", color: "#F7F5F0" },
    { media: "(prefers-color-scheme: dark)", color: "#0A1A33" },
  ],
};

/** يقرأ تفضيل الثيم المحفوظ قبل الرسم الأول لمنع وميض التبديل. */
const themeInit = `(function(){try{var t=localStorage.getItem("alelm-theme");if(t==="dark"||t==="light"){document.documentElement.dataset.theme=t}}catch(e){}})()`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${displayFont.variable} ${textFont.variable}`}
      suppressHydrationWarning
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        {children}
      </body>
    </html>
  );
}
