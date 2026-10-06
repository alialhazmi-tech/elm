import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { InfoIcon, InfoNav, SparkMark, type InfoIconName } from "@/app/_components/info-pages";
import { PublicEmailLink } from "@/app/_components/public-email-link";
import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";

export const metadata: Metadata = {
  title: "سياسة الخصوصية",
  description: "كيف تتعامل العلم مع بيانات مستخدميها: ما نعالجه ولماذا، وبياناتك عند استخدام أدوات الذكاء الاصطناعي، ومشاركة البيانات، وحقوقك وخياراتك.",
  alternates: { canonical: "/privacy-policy" },
};

/**
 * بيانات الاعتماد النظامي للسياسة. تبقى فارغة حتى يحسمها المالك، ولا يظهر سطرها قبل ذلك
 * بدل نشر نص مؤقت. حين تُملأ يظهر شريط «جهة التحكم» و«تاريخ السريان» تحت المقدمة.
 */
const POLICY_RECORD: { controller: string | null; effectiveDate: string | null } = {
  controller: null,
  effectiveDate: null,
};

const PRIVACY_EMAIL = "info@alelm.net";

const SECTIONS = [
  { id: "data", label: "البيانات وأغراضها" },
  { id: "ai", label: "الذكاء الاصطناعي" },
  { id: "cookies", label: "ملفات الارتباط" },
  { id: "sharing", label: "المشاركة والمزوّدون" },
  { id: "basis", label: "الأساس النظامي والاحتفاظ" },
  { id: "rights", label: "حقوقك وخياراتك" },
  { id: "security", label: "الحماية والتحديثات" },
] as const;

const DATA_ROWS: { name: string; ai?: boolean; includes: string; purpose: string }[] = [
  {
    name: "الحساب والتواصل",
    includes: "بيانات التسجيل وإدارة الدخول مثل الاسم والبريد الإلكتروني، وما ترسله عند التواصل أو الاشتراك في النشرة.",
    purpose: "إنشاء الحساب وتشغيله، وإدارة الاشتراكات، والرد على طلباتك.",
  },
  {
    name: "القراءة والتفاعل",
    includes: "الاهتمامات التي تختارها، والمواد المحفوظة، والإعجابات، وإشارات القراءة والتفاعل.",
    purpose: "تقديم وظائف الحساب، واقتراح محتوى مناسب، وقياس التفاعل، وفق الإعدادات المتاحة.",
  },
  {
    name: "البيانات التقنية",
    includes: "عنوان الاتصال بالإنترنت، ونوع المتصفح والجهاز، والصفحات المطلوبة، وأوقات الوصول، والسجلات الفنية.",
    purpose: "تشغيل المنصة وحمايتها، وتشخيص الأعطال، وفهم الاستخدام.",
  },
  {
    name: "طلبات الذكاء الاصطناعي",
    ai: true,
    includes: "سؤالك، والنص المنشور اللازم للإجابة أو التلخيص، وبيانات تشغيلية عن استخدام الخدمة، ونص الموجز عند الاستماع.",
    purpose: "تنفيذ طلبك: الإجابة أو التلخيص أو تحويل الموجز إلى صوت.",
  },
];

const BRIEF: { icon: InfoIconName; title: string; text: ReactNode }[] = [
  { icon: "noSale", title: "لا نبيع بياناتك ولا نؤجرها", text: "نتيحها لمزوّدي الخدمة بالقدر اللازم لتشغيلها." },
  { icon: "spark", title: "سؤالك للذكاء الاصطناعي لا يدخل ملف تخصيصك", text: "نسجّل استخدام الأداة وبيانات تشغيلها." },
  { icon: "sliders", title: "التخصيص بيدك", text: "أوقف الاقتراحات وامسح سجل القراءة من إعدادات الحساب." },
  { icon: "mail", title: "طلبات الخصوصية", text: <span className="ip-email"><PublicEmailLink email={PRIVACY_EMAIL} /></span> },
];

const PROVIDERS = ["الاستضافة", "التخزين", "إدارة الحسابات", "الاتصالات", "التحليلات", "الذكاء الاصطناعي"];

const RIGHTS = [
  { name: "العلم", text: "أن تعرف كيف تُعالج بياناتك." },
  { name: "الوصول", text: "أن تطّلع عليها وتطلب نسخة منها." },
  { name: "التصحيح", text: "طلب تصحيحها أو تحديثها أو إتمامها." },
  { name: "الإتلاف", text: "طلب إتلافها في الحالات المقررة." },
  { name: "الرجوع عن الموافقة", text: "حين تكون الموافقة أساس المعالجة، مع مراعاة الاستثناءات النظامية." },
  { name: "الشكوى", text: "إلى الجهة المختصة بحماية البيانات الشخصية عبر قنواتها الرسمية." },
];

export default function PrivacyPolicyPage() {
  const { controller, effectiveDate } = POLICY_RECORD;
  return (
    <>
      <a className="skip-link" href="#main-content">انتقل إلى المحتوى</a>
      <SiteHeader />
      <InfoNav current="/privacy-policy" />
      <main id="main-content" className="ip-page">
        <section className="ip-wrap ip-pv-hero">
          <p className="ip-eyebrow">الخصوصية</p>
          <h1 className="ip-display">سياسة الخصوصية</h1>
          <p className="ip-lead">
            توضح هذه السياسة كيف نتعامل مع بيانات مستخدمي العلم على alelm.net والخدمات المرتبطة بها، بما
            فيها العضوية والتخصيص وأدوات الذكاء الاصطناعي. ويختلف نطاق المعالجة بحسب الخدمة التي
            تستخدمها والبيانات التي تقدمها.
          </p>
          {controller || effectiveDate ? (
            <dl className="ip-pv-meta">
              {controller ? <div><dt>جهة التحكم في البيانات</dt><dd>{controller}</dd></div> : null}
              {effectiveDate ? <div><dt>تاريخ السريان</dt><dd>{effectiveDate}</dd></div> : null}
            </dl>
          ) : null}
        </section>

        <ul className="ip-wrap ip-brief" aria-label="باختصار">
          {BRIEF.map((item) => (
            <li key={item.title}>
              {item.icon === "spark" ? <SparkMark /> : <InfoIcon name={item.icon} />}
              <b>{item.title}</b>
              <span>{item.text}</span>
            </li>
          ))}
        </ul>

        <div className="ip-wrap ip-pv-layout">
          <nav className="ip-toc" aria-label="محتويات السياسة">
            <p>في هذه الصفحة</p>
            <ol>
              {SECTIONS.map((section) => <li key={section.id}><a href={`#${section.id}`}>{section.label}</a></li>)}
            </ol>
          </nav>

          <div>
            <section className="ip-pv-sec" id="data" aria-labelledby="data-title">
              <h2 className="ip-h2" id="data-title">البيانات التي نعالجها وأغراضها</h2>
              <div className="ip-dtable" role="table" aria-label="فئات البيانات وأغراضها">
                <div className="ip-drow ip-drow-head" role="row">
                  <span role="columnheader">الفئة</span><span role="columnheader">ما تشمله</span><span role="columnheader">لماذا نستخدمها</span>
                </div>
                {DATA_ROWS.map((row) => (
                  <div className="ip-drow" role="row" key={row.name}>
                    <b role="rowheader">{row.ai ? <SparkMark /> : null}{row.name}</b>
                    <span role="cell"><span className="ip-drow-k">ما تشمله</span>{row.includes}</span>
                    <span role="cell"><span className="ip-drow-k">لماذا نستخدمها</span>{row.purpose}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="ip-pv-sec" id="ai" aria-labelledby="ai-title">
              <h2 className="ip-h2" id="ai-title">بياناتك عند استخدام الذكاء الاصطناعي</h2>
              <p className="ip-body">
                لمعالجة طلبك قد يُرسل نص المادة وسؤالك إلى مزوّد خارجي للنموذج، وقد يمر الطلب عبر وسيط تقني
                قبل وصوله إلى المزوّد. وعند الاستماع يُرسل نص الموجز إلى مزوّد التوليد الصوتي.
              </p>
              <figure className="ip-flow">
                <div className="ip-node"><b>سؤالك ونص المادة</b><span>من صفحة المادة</span></div>
                <InfoIcon name="arrow" />
                <div className="ip-node"><b>منصة العلم</b><span>تسجّل استخدام الأداة وبيانات تشغيلها</span></div>
                <InfoIcon name="arrow" />
                <div className="ip-node ip-node-ext"><b>وسيط تقني</b><span>في بعض الطلبات</span></div>
                <InfoIcon name="arrow" />
                <div className="ip-node ip-node-ext"><b>مزوّد النموذج</b><span>يعالج الطلب ويعيد الإجابة</span></div>
                <figcaption><InfoIcon name="lock" />لا يُضاف نص السؤال أو الإجابة إلى ملف تخصيصك.</figcaption>
              </figure>
              <div className="ip-never" role="note">
                <InfoIcon name="alert" />
                <b>لا تكتب في حقل السؤال معلومات حساسة</b>
                <p>تجنّب كلمات المرور وأرقام الهوية والبيانات الصحية والمالية وأي معلومات سرية.</p>
              </div>
              <p className="ip-body">
                عدم إضافة السؤال إلى ملف التخصيص لا يعني أنه لا يُعالج أو يُحتفظ به لدى المزوّد. تفاصيل
                الاحتفاظ واستخدام المدخلات لدى الأطراف الخارجية ترتبط بالخدمة والعقد وإعدادات الحساب.
              </p>
            </section>

            <section className="ip-pv-sec" id="cookies" aria-labelledby="cookies-title">
              <h2 className="ip-h2" id="cookies-title">ملفات الارتباط وتقنيات القياس</h2>
              <p className="ip-body">
                تستخدم المنصة ملفات ارتباط وتقنيات تخزين لتشغيل الجلسات وحفظ بعض التفضيلات وقياس الاستخدام.
                يمكنك إدارة ملفات الارتباط من المتصفح، وقد تتأثر بعض الوظائف بذلك.
              </p>
              <p className="ip-body">
                ونستخدم معرّف متصفح عشوائيًا لقياس وقت القراءة الفعلي والتقدم في المادة، وعرض مؤشرات مجمّعة
                لجميع الزوار. يبقى المعرّف ستة أشهر، وقد نربط القراءة بالتفاعلات المحفوظة عند تسجيل الدخول.
                ويحترم هذا القياس إعداد عدم التتبع في المتصفح وتعطيل التخصيص في حساب العضو.
              </p>
              <p className="ip-body">إيقاف التخصيص داخل الحساب لا يساوي تعطيل جميع أدوات التحليل، ولا حذف الحساب.</p>
            </section>

            <section className="ip-pv-sec" id="sharing" aria-labelledby="sharing-title">
              <h2 className="ip-h2" id="sharing-title">مشاركة البيانات ومزوّدو الخدمة</h2>
              <p className="ip-no-sell">لا نبيع البيانات الشخصية ولا نؤجرها.</p>
              <p className="ip-body">
                قد تُتاح البيانات اللازمة لمزوّدين يشغّلون الخدمة، أو يُفصح عنها عند وجود متطلب نظامي واجب
                التطبيق. والاستعانة بمزوّد تقني لا تعني إتاحة بياناتك للعامة.
              </p>
              <ul className="ip-chips" aria-label="فئات مزوّدي الخدمة">
                {PROVIDERS.map((provider) => <li key={provider}>{provider}</li>)}
              </ul>
              <p className="ip-body">قد تتم بعض المعالجة خارج المملكة بحسب مواقع المزوّدين وبنيتهم التشغيلية.</p>
            </section>

            <section className="ip-pv-sec" id="basis" aria-labelledby="basis-title">
              <h2 className="ip-h2" id="basis-title">الأساس النظامي والاحتفاظ</h2>
              <p className="ip-body">
                تستند كل معالجة إلى المسوّغ النظامي المناسب لغرضها: الموافقة حين تلزم، أو تنفيذ اتفاق تكون
                طرفًا فيه، أو الوفاء بالتزام نظامي، أو المصلحة المشروعة حيث تنطبق شروطها. ولا تُعد زيارة
                المنصة وحدها موافقة شاملة على جميع أغراض المعالجة.
              </p>
              <p className="ip-body">
                نحتفظ بالبيانات بحسب غرض جمعها والمتطلبات النظامية ذات الصلة، ونتلفها عند انتهاء الحاجة إليها
                ما لم يوجد مسوّغ للاحتفاظ.
              </p>
            </section>

            <section className="ip-pv-sec" id="rights" aria-labelledby="rights-title">
              <h2 className="ip-h2" id="rights-title">حقوقك وخياراتك</h2>
              <p className="ip-body">وفق نظام حماية البيانات الشخصية وأحكامه المنطبقة، لك:</p>
              <ul className="ip-rights">
                {RIGHTS.map((right) => <li className="ip-right" key={right.name}><b>{right.name}</b><span>{right.text}</span></li>)}
              </ul>
              <p className="ip-body">
                ومن <Link className="ip-link" href="/account">إعدادات الحساب</Link> تستطيع إيقاف الاقتراحات المخصصة،
                ومسح سجل القراءة وبيانات التخصيص المستنتجة، وإدارة اشتراكك في النشرة. مسح السجل لا يحذف
                المواد المحفوظة ولا الإعجابات ولا الموضوعات التي اخترتها، ولا يُعد حذفًا للحساب أو لجميع البيانات.
              </p>
              <div className="ip-request">
                <p>لتقديم طلب يتعلق بالخصوصية راسلنا مع توضيح طبيعة طلبك. قد نحتاج إلى التحقق من هويتك بالقدر المناسب لحماية بياناتك.</p>
                <span className="ip-email"><PublicEmailLink email={PRIVACY_EMAIL} /></span>
              </div>
            </section>

            <section className="ip-pv-sec" id="security" aria-labelledby="security-title">
              <h2 className="ip-h2" id="security-title">الحماية والتحديثات والروابط الخارجية</h2>
              <p className="ip-body">
                نستخدم تدابير تقنية وتنظيمية للحد من الوصول غير المصرح به وحماية البيانات، دون ادعاء أمان
                مطلق. والمواقع الخارجية تخضع لسياساتها الخاصة. وعند تحديث هذه السياسة نبيّن تاريخ السريان
                ونوضح التغييرات الجوهرية، ونطلب موافقة جديدة إذا استلزمها النظام.
              </p>
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
