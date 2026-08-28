import type { Metadata } from "next";

import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";

/**
 * صفحة إرثية من الموقع القديم — النص مرآة نسخة الخصوصية المعتمدة في تطبيق iOS،
 * والسياسة القانونية الكاملة تُعتمد من المالك قبل الإطلاق (نفس تحفظ التطبيق).
 */

export const metadata: Metadata = {
  title: "سياسة الخصوصية",
  description: "خصوصيتك في منصة العلم: اختياراتك بيدك، وحسابك مستقل، وأنت المتحكم.",
  alternates: { canonical: "/privacy-policy" },
};

const ITEMS = [
  {
    title: "اختياراتك عندك",
    text: "الاهتمامات والمحفوظات وإعدادات المظهر تُحفظ لتجربتك أنت، ولا تُستخدم خارج تخصيص محتواك.",
  },
  {
    title: "الحساب مستقل",
    text: "بيانات عضويتك تُستخدم للدخول ومزامنة تجربتك، ولا تمنح أي صلاحيات تحريرية.",
  },
  {
    title: "أنت المتحكم",
    text: "يمكنك إيقاف التخصيص، ومسح إشارات القراءة المستنتجة، وتعديل اهتماماتك أو حذف حسابك في أي وقت.",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <>
      <a className="skip-link" href="#main-content">انتقل إلى المحتوى</a>
      <SiteHeader />
      <main id="main-content">
        <section className="hub-hero">
          <p className="eyebrow">الخصوصية</p>
          <h1>خصوصيتك ليست ثمن التخصيص</h1>
        </section>
        <div className="wrap" style={{ maxWidth: 720, paddingBottom: 48 }}>
          {ITEMS.map((item) => (
            <p key={item.title} style={{ lineHeight: 1.9 }}>
              <strong>{item.title}.</strong> {item.text}
            </p>
          ))}
          <p style={{ lineHeight: 1.9, color: "var(--muted, #4e5f78)", fontSize: 14 }}>
            هذه نسخة مختصرة. تُنشر السياسة القانونية الكاملة المعتمدة قبل الإطلاق الرسمي.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
