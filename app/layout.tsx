import type { Metadata, Viewport } from "next";
import { Alexandria, Readex_Pro } from "next/font/google";
import "./globals.css";

const displayFont = Alexandria({
  subsets: ["arabic", "latin"],
  weight: ["700", "800"],
  variable: "--f-display",
  display: "swap",
});

const textFont = Readex_Pro({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700"],
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
    { media: "(prefers-color-scheme: light)", color: "#f5f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1322" },
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
