import type { Metadata } from "next";
import Link from "next/link";

import { EditorMark, InfoIcon, InfoNav, ProvenanceTag, SparkMark } from "@/app/_components/info-pages";
import { PublicEmailLink } from "@/app/_components/public-email-link";
import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";

export const metadata: Metadata = {
  title: "الذكاء الاصطناعي في العلم",
  description: "كيف تستخدم العلم الذكاء الاصطناعي: أدوات تساعد القارئ على الفهم، وأدوات تدعم المحرر، وحدود نعلنها، ومسؤولية تحريرية لا تنتقل إلى الآلة.",
  alternates: { canonical: "/ai" },
};

const WAVE = [30, 60, 85, 45, 70, 95, 55, 35, 75, 50, 80, 40, 65, 30, 55, 20];
const EDITING_TASKS = ["اقتراح العناوين", "التدقيق اللغوي", "تحسين الفقرات", "إعداد الموجز", "التصنيف والكلمات المفتاحية", "أوصاف البحث", "مسودات وملحقات"];
const VISUAL_TASKS = ["خطة شرائح «جاك العلم»", "تصور الإنفوجرافيك التفاعلي", "صور توضيحية"];

export default function AiPage() {
  return (
    <>
      <a className="skip-link" href="#main-content">انتقل إلى المحتوى</a>
      <SiteHeader />
      <InfoNav current="/ai" />
      <main id="main-content" className="ip-page">
        <section className="ip-wrap ip-ai-hero">
          <div>
            <p className="ip-eyebrow ip-eyebrow-spark"><SparkMark />خدمات الذكاء الاصطناعي</p>
            <h1 className="ip-display">الذكاء الاصطناعي في العلم</h1>
            <p className="ip-lead">
              نستخدمه لتسهيل فهم المحتوى وتطوير إنتاجه. بعض أدواته يستخدمها القارئ مباشرة، وبعضها
              يساعد المحرر داخل غرفة الأخبار. وفي الحالتين نعلن أين يعمل.
            </p>
            <dl className="ip-legend">
              <div>
                <dt><EditorMark /><b>يراجعه المحرر</b></dt>
                <dd>اقتراحات ومسودات غرفة الأخبار، تمر على المحرر قبل اعتمادها ونشرها.</dd>
              </div>
              <div>
                <dt><SparkMark /><b>مولّد آليًا عند الطلب</b></dt>
                <dd>ملخصات القارئ وإجابات أسئلته، تظهر له مباشرة دون مراجعة بشرية مسبقة.</dd>
              </div>
            </dl>
          </div>

          <figure className="ip-specimen" aria-label="مثال توضيحي لأداة لخّص لي">
            <div className="ip-spec-top"><span>مثال توضيحي</span><span>صفحة مادة</span></div>
            <div className="ip-spec-article">
              <span className="ip-spec-kicker">أبسط</span>
              <h2>كيف تحوّل محطات التحلية ماء البحر إلى ماء شرب؟</h2>
              <p>
                تعتمد المحطات الحديثة على <mark className="ip-hl">فصل الأملاح عن ماء البحر بالتبخير أو بالأغشية</mark>.
                وفي طريقة التناضح العكسي <mark className="ip-hl">يُدفع الماء بضغط عالٍ عبر غشاء دقيق</mark> يحجز
                الأملاح، ثم يُعالج قبل ضخه في الشبكة. <mark className="ip-hl">وتبقى الطاقة أكبر بنود التكلفة</mark>،
                لذلك تتجه المحطات إلى تقنيات أكفأ…
              </p>
            </div>
            <div className="ip-spec-tools" aria-hidden="true">
              <span className="ip-tool-btn is-on"><InfoIcon name="spark" />لخّص لي</span>
              <span className="ip-tool-btn"><InfoIcon name="spark" />اسأل عن هذه المادة</span>
              <span className="ip-tool-btn"><InfoIcon name="play" />استمع</span>
            </div>
            <figcaption className="ip-spec-out">
              <div className="ip-spec-out-head">الخلاصة في ثلاث نقاط<ProvenanceTag kind="ai">مولّد آليًا</ProvenanceTag></div>
              <ul>
                <li>تفصل المحطات الأملاح عن ماء البحر بالتبخير أو بالأغشية.</li>
                <li>التناضح العكسي يدفع الماء بضغط عالٍ عبر غشاء يحجز الأملاح.</li>
                <li>الطاقة أكبر بنود التكلفة، والاتجاه إلى تقنيات أكفأ.</li>
              </ul>
              <small>مدخل سريع إلى المادة. النص الكامل هو المرجع للتفاصيل والشروط والسياق.</small>
            </figcaption>
          </figure>
        </section>

        <section className="ip-wrap ip-section">
          <div className="ip-section-head">
            <h2 className="ip-h2">أدوات تساعد القارئ</h2>
            <p className="ip-body">ثلاث أدوات تظهر في صفحة المادة. لكل واحدة عمل محدد وحدود نعلنها.</p>
          </div>
          <div className="ip-tools">
            <article className="ip-tool">
              <h3><SparkMark />لخّص لي</h3>
              <p>تولّد خلاصة للمادة في ثلاث نقاط، مدخلًا سريعًا إلى أهم ما ورد فيها.</p>
              <div className="ip-mini" aria-hidden="true">
                <div className="ip-bubble ip-bubble-a ip-bubble-row">تفصل المحطات الأملاح بالتبخير أو بالأغشية…</div>
                <div className="ip-bubble ip-bubble-a ip-bubble-row">التناضح العكسي يدفع الماء عبر غشاء…</div>
                <div className="ip-bubble ip-bubble-a ip-bubble-row">الطاقة أكبر بنود التكلفة…</div>
              </div>
              <p className="ip-isnt"><b>ما لا تعنيه:</b> لا تغني عن النص الكامل، فهو المرجع للتفاصيل والشروط والسياق.</p>
            </article>
            <article className="ip-tool">
              <h3><SparkMark />اسأل عن هذه المادة</h3>
              <p>اطرح سؤالًا عن المحتوى المنشور، وتصلك إجابة آلية مستندة إلى نصه.</p>
              <div className="ip-mini" aria-hidden="true">
                <div className="ip-bubble ip-bubble-q">ما أكبر تكلفة في التحلية؟</div>
                <div className="ip-bubble ip-bubble-a">بحسب المادة، الطاقة هي أكبر بنود التكلفة.</div>
                <div className="ip-bubble ip-bubble-q">كم محطة في المملكة؟</div>
                <div className="ip-bubble ip-bubble-a ip-bubble-none">لا يتضمن نص المادة إجابة عن هذا السؤال.</div>
              </div>
              <p className="ip-isnt"><b>ما لا تعنيه:</b> ليست بحثًا مفتوحًا في الإنترنت، ولا تحققًا مستقلًا من الخبر. وإذا لم يتضمن النص الإجابة فالمطلوب منها أن تقول ذلك.</p>
            </article>
            <article className="ip-tool">
              <h3><SparkMark />الاستماع إلى الموجز</h3>
              <p>تحوّل موجز المادة ومختارات «موجز العلم» إلى صوت اصطناعي تستمع إليه.</p>
              <div className="ip-mini" aria-hidden="true">
                <div className="ip-player">
                  <span className="ip-play"><InfoIcon name="play" /></span>
                  <span className="ip-wave">{WAVE.map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</span>
                </div>
                <ProvenanceTag kind="ai">صوت اصطناعي</ProvenanceTag>
              </div>
              <p className="ip-isnt"><b>ما لا تعنيه:</b> تقرأ الخلاصة لا المادة كاملة، وليست تسجيلًا بشريًا.</p>
            </article>
          </div>
          <p className="ip-avail"><InfoIcon name="info" />قد ترتبط إتاحة بعض الخدمات بتسجيل الدخول وحدود الاستخدام وتوافر الخدمة.</p>
        </section>

        <section className="ip-wrap ip-section">
          <div className="ip-section-head">
            <h2 className="ip-h2">داخل غرفة الأخبار</h2>
            <p className="ip-body">الأداة تقترح، والمحرر يقرر. لا تُنشر مادة قبل أن يراجعها ويعتمدها فريق التحرير.</p>
          </div>
          <div className="ip-pipeline">
            <div className="ip-pipe ip-pipe-ai">
              <h3><SparkMark />الأداة تقترح</h3>
              <h4>في التحرير</h4>
              <ul className="ip-chips">{EDITING_TASKS.map((task) => <li key={task}>{task}</li>)}</ul>
              <h4>في الإنتاج البصري</h4>
              <ul className="ip-chips">{VISUAL_TASKS.map((task) => <li key={task}>{task}</li>)}</ul>
            </div>
            <div className="ip-pipe-arrow" aria-hidden="true"><InfoIcon name="arrow" /></div>
            <div className="ip-pipe ip-pipe-editor">
              <h3><EditorMark />المحرر يراجع</h3>
              <ul className="ip-checks">
                <li><InfoIcon name="check" />يتحقق من الأرقام والنصوص</li>
                <li><InfoIcon name="check" />يطابق الصورة مع الحدث</li>
                <li><InfoIcon name="check" />يعدّل الاقتراح أو يرفضه</li>
              </ul>
            </div>
            <div className="ip-pipe-arrow" aria-hidden="true"><InfoIcon name="arrow" /></div>
            <div className="ip-pipe">
              <h3><InfoIcon name="check" className="ip-editor" />الاعتماد والنشر</h3>
              <p>تُنشر المادة بعد اعتمادها، ومسؤوليتها على المنصة وفريقها التحريري.</p>
            </div>
          </div>
        </section>

        <section className="ip-wrap ip-section">
          <div className="ip-personal">
            <div>
              <h2 className="ip-h2">تجربة قراءة تراعي اهتماماتك</h2>
              <p className="ip-body" style={{ marginTop: 16 }}>
                تستفيد اقتراحات القراءة في صفحة «لك» من الموضوعات التي تختارها ونشاط قراءتك وتفاعلك.
                وتستطيع إيقافها ومسح سجلك متى شئت.
              </p>
              <p className="ip-body ip-muted">هذه آلية توصية بالمحتوى، ولا تعني إرسال سجل قراءتك تلقائيًا إلى نموذج لغوي.</p>
            </div>
            <div className="ip-settings">
              <div className="ip-settings-row">
                <div><b>الاقتراحات المخصصة</b><span>اقتراحات صفحة «لك» حسب اهتماماتك</span></div>
                <span className="ip-switch" aria-hidden="true" />
              </div>
              <div className="ip-settings-row">
                <div><b>سجل القراءة وبيانات التخصيص</b><span>يبقى المحفوظ والإعجابات والموضوعات المختارة</span></div>
                <Link href="/account">إعدادات الحساب</Link>
              </div>
              <div className="ip-settings-foot">تجدهما في إعدادات حسابك</div>
            </div>
          </div>
        </section>

        <section className="ip-wrap ip-section">
          <p className="ip-eyebrow">الشفافية والمسؤولية التحريرية</p>
          <h2 className="ip-resp-quote">مسؤولية المحتوى المنشور على منصة العلم وفريقها التحريري، أيًّا كانت الأداة التي ساعدت في إعداده.</h2>

          <div className="ip-compare">
            <table>
              <thead>
                <tr>
                  <td />
                  <th scope="col"><span><EditorMark />أدوات غرفة الأخبار</span></th>
                  <th scope="col"><span><SparkMark />ملخصات القارئ وإجاباته</span></th>
                </tr>
              </thead>
              <tbody>
                <tr><th scope="row">طبيعة المخرج</th><td>اقتراحات ومسودات</td><td>مخرج آلي يولّد عند الطلب</td></tr>
                <tr><th scope="row">من يراه أولًا</th><td>المحرر، داخل مسار الإعداد</td><td>القارئ مباشرة</td></tr>
                <tr><th scope="row">المراجعة البشرية</th><td>يراجعه المحرر ويعتمده قبل النشر</td><td>لا تُعد كل إجابة مراجعة بشريًا أو نسخة معتمدة من المادة</td></tr>
              </tbody>
            </table>
          </div>

          <div className="ip-principles">
            <div className="ip-principle">
              <h3 className="ip-h3">حدود المخرجات الذكية</h3>
              <p className="ip-body">
                قد تخطئ النماذج في الفهم أو الاختصار أو ترتيب المعلومات، وقد تُسقط قيدًا مؤثرًا. الضوابط
                التقنية تقلل الأخطاء ولا تضمن غيابها، فارجع إلى النص الأصلي ومصادره قبل الاقتباس أو
                الاعتماد على مخرج آلي.
              </p>
              <p className="ip-caution">
                <InfoIcon name="alert" />
                <span>هذه الخدمات تقدّم شرحًا معرفيًا عامًا. في المسائل الصحية والقانونية والمالية ارجع إلى المختص والمصدر المعتمد قبل أي قرار يترتب عليه أثر شخصي.</span>
              </p>
            </div>
            <div className="ip-principle">
              <h3 className="ip-h3">وضوح الصور والأصوات</h3>
              <p className="ip-body">
                نفصح عن الصور المولّدة بالذكاء الاصطناعي عند استخدامها، وعن الطبيعة الاصطناعية للصوت.
                الصورة التوضيحية تقرّب الفكرة، وليست صورة توثيقية لحدث حقيقي، ولا ننسب بها إلى أحد فعلًا
                أو قولًا غير ثابت.
              </p>
              <figure className="ip-figure">
                <div className="ip-figure-img" role="img" aria-label="مثال لوسم صورة مولّدة">
                  <ProvenanceTag kind="ai">صورة توضيحية مولّدة بالذكاء الاصطناعي</ProvenanceTag>
                </div>
                <figcaption>هكذا يظهر الوسم على الصور المولّدة في المواد.</figcaption>
              </figure>
            </div>
            <div className="ip-principle">
              <h3 className="ip-h3">المصادر والتصحيح</h3>
              <p className="ip-body">
                ننسب المعلومات إلى مصادرها، ونبيّن حدود البيانات والسيناريوهات، ونحترم حقوق الملكية
                الفكرية. ونرحب بكل ملاحظة تصحح خطأ أو توضح سياقًا. أرفق معها:
              </p>
              <ul className="ip-chips ip-fix-list">
                <li>رابط المادة</li>
                <li>موضع الملاحظة</li>
                <li>المصدر الداعم إن وُجد</li>
              </ul>
            </div>
            <div className="ip-principle">
              <h3 className="ip-h3">للتواصل</h3>
              <p className="ip-body">ملاحظاتك على أدوات الذكاء الاصطناعي أو على أي مادة منشورة تصلنا على البريد:</p>
              <span className="ip-email"><PublicEmailLink email="info@alelm.net" /></span>
              <p className="ip-body ip-muted">
                وما يتعلق ببياناتك عند استخدام هذه الأدوات تجده في <Link className="ip-link" href="/privacy-policy">سياسة الخصوصية</Link>.
              </p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
