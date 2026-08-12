"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { prototypeInterests, prototypeStories, type PrototypeStory } from "@/lib/membership/prototype-data";

type View = "visitor" | "signup" | "otp" | "welcome" | "interests" | "suggestions" | "ready" | "feed" | "story" | "account";
type Scenario = "normal" | "empty" | "expired" | "otp-error" | "slow" | "ai-down" | "new";

const nav = ["الرئيسية", "السلاسل", "محليات", "اقتصاد", "رياضة", "تحليل", "مرئي"];

function Brand() {
  return (
    <span className="mp-brand" aria-label="العلم — المعرفة بسلاسة">
      <strong>العِلم</strong><small>المعرفة بسلاسة</small>
    </span>
  );
}

function Icon({ children }: { children: string }) {
  return <span className="mp-icon" aria-hidden="true">{children}</span>;
}

export default function MembershipPrototype() {
  const [view, setView] = useState<View>("visitor");
  const [scenario, setScenario] = useState<Scenario>("normal");
  const [method, setMethod] = useState<"mobile" | "email">("mobile");
  const [identity, setIdentity] = useState("05 1234 5678");
  const [name, setName] = useState("سارة");
  const [selected, setSelected] = useState<string[]>(["science", "technology", "health"]);
  const [saved, setSaved] = useState<string[]>([]);
  const [story, setStory] = useState<PrototypeStory>(prototypeStories[0]);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [personalization, setPersonalization] = useState(true);

  const feed = useMemo(() => {
    if (scenario === "empty") return [];
    const scored = prototypeStories.map((item) => ({
      item,
      score: item.interestIds.filter((id) => selected.includes(id)).length,
    }));
    return scored.sort((a, b) => b.score - a.score).map(({ item }) => item);
  }, [scenario, selected]);

  const openStory = (item: PrototypeStory) => {
    setStory(item);
    setReasonOpen(false);
    setView("story");
  };

  const toggleInterest = (id: string) => {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const goToScenario = (value: Scenario) => {
    setScenario(value);
    if (value === "otp-error") setView("otp");
    else if (value === "expired") setView("feed");
    else setView("feed");
  };

  return (
    <main className="membership-prototype" dir="rtl">
      <a className="mp-skip" href="#membership-content">تجاوز إلى المحتوى</a>
      <header className="mp-header">
        <div className="mp-header-inner">
          <button className="mp-brand-button" onClick={() => setView(view === "visitor" ? "visitor" : "feed")}><Brand /></button>
          <nav aria-label="التنقل الرئيسي">{nav.map((item) => <span key={item}>{item}</span>)}</nav>
          <div className="mp-tools">
            <button className="mp-search"><Icon>⌕</Icon><span>ابحث في العلم…</span></button>
            {view === "visitor" ? (
              <button className="mp-join" onClick={() => setView("signup")}>انضم إلى العلم</button>
            ) : (
              <button className="mp-avatar" onClick={() => setView("account")} aria-label="الحساب">س</button>
            )}
          </div>
        </div>
      </header>

      {scenario !== "normal" && <ScenarioBanner scenario={scenario} onReset={() => setScenario("normal")} onSignup={() => setView("signup")} />}

      <div id="membership-content">
        {view === "visitor" && <Visitor onJoin={() => setView("signup")} onStory={() => openStory(prototypeStories[0])} />}
        {view === "signup" && (
          <Signup method={method} identity={identity} onMethod={setMethod} onIdentity={setIdentity} onContinue={() => setView("otp")} />
        )}
        {view === "otp" && <Otp identity={identity} failed={scenario === "otp-error"} onBack={() => setView("signup")} onContinue={() => setView("welcome")} />}
        {view === "welcome" && <Welcome name={name} onName={setName} onContinue={() => setView("interests")} />}
        {view === "interests" && (
          <Interests selected={selected} onToggle={toggleInterest} onSkip={() => { setSelected([]); setView("ready"); }} onContinue={() => setView("suggestions")} />
        )}
        {view === "suggestions" && <Suggestions selected={selected} onToggle={toggleInterest} onBack={() => setView("interests")} onContinue={() => setView("ready")} />}
        {view === "ready" && <Ready name={name} count={selected.length} onContinue={() => setView("feed")} />}
        {view === "feed" && <Feed name={name} stories={feed} isNew={scenario === "new" || selected.length === 0} aiDown={scenario === "ai-down"} slow={scenario === "slow"} onStory={openStory} onInterests={() => setView("interests")} />}
        {view === "story" && <Story story={story} saved={saved.includes(story.id)} reasonOpen={reasonOpen} onReason={() => setReasonOpen(!reasonOpen)} onSave={() => setSaved((items) => items.includes(story.id) ? items.filter((id) => id !== story.id) : [...items, story.id])} onBack={() => setView("feed")} />}
        {view === "account" && <Account name={name} selected={selected} saved={saved.length} personalization={personalization} onToggle={() => setPersonalization(!personalization)} onInterests={() => setView("interests")} onBack={() => setView("feed")} />}
      </div>

      <aside className="mp-lab" aria-label="حالات النموذج">
        <label htmlFor="prototype-scenario">اختبر حالة</label>
        <select id="prototype-scenario" value={scenario} onChange={(event) => goToScenario(event.target.value as Scenario)}>
          <option value="normal">المسار الطبيعي</option>
          <option value="empty">لا يوجد محتوى مناسب</option>
          <option value="new">عضو جديد بلا تخصيص</option>
          <option value="expired">انتهت الجلسة</option>
          <option value="otp-error">رمز تحقق خاطئ</option>
          <option value="slow">اتصال ضعيف</option>
          <option value="ai-down">التوصيات الذكية متوقفة</option>
        </select>
        <span>بيانات تجريبية — لا تُحفظ</span>
      </aside>
    </main>
  );
}

function Visitor({ onJoin, onStory }: { onJoin: () => void; onStory: () => void }) {
  return (
    <section className="mp-visitor mp-wrap">
      <div className="mp-day"><span>الأربعاء، 12 أغسطس 2026</span><b>موجز اليوم</b></div>
      <div className="mp-hero">
        <div className="mp-hero-copy">
          <span className="mp-kicker">العلم أقرب إليك</span>
          <h1>معرفة تختارها أنت.<br />وتصل إليك بسلاسة.</h1>
          <p>أنشئ حسابك واختر ما يهمك، لنرتّب لك أفضل ما ينشره العلم دون أن نحجب عنك بقية العالم.</p>
          <button className="mp-primary" onClick={onJoin}>ابدأ عضويتك المجانية <Icon>←</Icon></button>
          <small>دقيقة واحدة فقط · ويمكنك تغيير اختياراتك متى شئت</small>
        </div>
        <button className="mp-feature" onClick={onStory} aria-label="فتح المادة المميزة">
          <Image src={prototypeStories[0].image} alt="كوكب الأرض من الفضاء" fill sizes="(max-width: 900px) 100vw, 55vw" priority unoptimized />
          <span className="mp-feature-overlay"><em>إفهمها صح</em><strong>{prototypeStories[0].title}</strong><small>4 دقائق قراءة</small></span>
        </button>
      </div>
      <div className="mp-promise"><span><Icon>✓</Icon><b>اختيارات واضحة</b><small>أنت من يحدد اهتماماتك</small></span><span><Icon>◎</Icon><b>تنويع تحريري</b><small>لا نحبسك داخل فقاعة</small></span><span><Icon>◌</Icon><b>خصوصية أولًا</b><small>تحكم كامل في بياناتك</small></span></div>
    </section>
  );
}

function StepShell({ step, title, intro, children }: { step: string; title: string; intro: string; children: React.ReactNode }) {
  return <section className="mp-onboard"><div className="mp-progress"><span style={{ width: step }} /></div><div className="mp-panel"><span className="mp-kicker">عضوية العلم</span><h1>{title}</h1><p>{intro}</p>{children}</div><small className="mp-security">خصوصيتك مهمة. لن نشارك بياناتك أو نستخدمها للإعلانات المزعجة.</small></section>;
}

function Signup({ method, identity, onMethod, onIdentity, onContinue }: { method: "mobile" | "email"; identity: string; onMethod: (v: "mobile" | "email") => void; onIdentity: (v: string) => void; onContinue: () => void }) {
  return <StepShell step="20%" title="أهلًا بك في العلم" intro="عضوية واحدة تجعل تجربتك أهدأ، أقرب، وأكثر صلة بك.">
    <div className="mp-tabs"><button className={method === "mobile" ? "active" : ""} onClick={() => onMethod("mobile")}>رقم الجوال</button><button className={method === "email" ? "active" : ""} onClick={() => onMethod("email")}>البريد الإلكتروني</button></div>
    <label className="mp-field"><span>{method === "mobile" ? "رقم الجوال" : "البريد الإلكتروني"}</span><input dir="ltr" value={identity} onChange={(event) => onIdentity(event.target.value)} inputMode={method === "mobile" ? "tel" : "email"} /><small>{method === "mobile" ? "سنرسل رمز تحقق برسالة نصية" : "سنرسل رابطًا ورمز تحقق إلى بريدك"}</small></label>
    <button className="mp-primary mp-wide" onClick={onContinue}>متابعة</button><p className="mp-terms">بالمتابعة أنت توافق على شروط الاستخدام وسياسة الخصوصية.</p>
  </StepShell>;
}

function Otp({ identity, failed, onBack, onContinue }: { identity: string; failed: boolean; onBack: () => void; onContinue: () => void }) {
  return <StepShell step="34%" title="تحقق من الرمز" intro={`أرسلنا رمزًا من 6 أرقام إلى ${identity}`}>
    <div className={`mp-otp ${failed ? "has-error" : ""}`} dir="ltr">{[4, 8, 2, 7, 1, 9].map((n, i) => <input key={i} value={failed && i === 5 ? 0 : n} readOnly aria-label={`الرقم ${i + 1}`} />)}</div>
    {failed && <p className="mp-error" role="alert">الرمز غير صحيح أو انتهت صلاحيته. جرّب مرة أخرى.</p>}
    <button className="mp-primary mp-wide" onClick={onContinue}>تحقق ومتابعة</button><div className="mp-inline-actions"><button onClick={onBack}>تغيير الرقم</button><button>إعادة الإرسال <b>00:24</b></button></div><p className="mp-existing">إذا كان لديك حساب سابق سنعيدك إليه تلقائيًا.</p>
  </StepShell>;
}

function Welcome({ name, onName, onContinue }: { name: string; onName: (v: string) => void; onContinue: () => void }) {
  return <StepShell step="45%" title="سعدنا بانضمامك" intro="كيف تحب أن نناديك؟">
    <div className="mp-welcome-mark">عِ</div><label className="mp-field"><span>الاسم الأول</span><input value={name} onChange={(event) => onName(event.target.value)} maxLength={24} /></label><button className="mp-primary mp-wide" onClick={onContinue}>لنضبط تجربتك <Icon>←</Icon></button>
  </StepShell>;
}

function Interests({ selected, onToggle, onSkip, onContinue }: { selected: string[]; onToggle: (id: string) => void; onSkip: () => void; onContinue: () => void }) {
  return <section className="mp-choice mp-wrap"><div className="mp-progress"><span style={{ width: "62%" }} /></div><header><span className="mp-kicker">خطوتك الأهم</span><h1>ما الذي يثير فضولك؟</h1><p>اختر ما يهمك الآن. نقترح 3 اهتمامات على الأقل لتجربة أدق.</p></header><div className="mp-interest-grid">{prototypeInterests.map((item) => <button key={item.id} className={selected.includes(item.id) ? "selected" : ""} style={{ "--interest": item.color } as React.CSSProperties} onClick={() => onToggle(item.id)}><span className="mp-check">{selected.includes(item.id) ? "✓" : "+"}</span><b>{item.label}</b><small>{item.description}</small></button>)}</div><footer><button className="mp-secondary" onClick={onSkip}>سأتصفح أولًا</button><button className="mp-primary" disabled={selected.length === 0} onClick={onContinue}>متابعة <span className="mp-count">{selected.length}</span></button></footer></section>;
}

function Suggestions({ selected, onToggle, onBack, onContinue }: { selected: string[]; onToggle: (id: string) => void; onBack: () => void; onContinue: () => void }) {
  const suggestions = prototypeInterests.filter((item) => !selected.includes(item.id)).slice(0, 3);
  return <section className="mp-choice mp-wrap mp-suggest"><div className="mp-progress"><span style={{ width: "76%" }} /></div><header><span className="mp-ai-label"><Icon>✦</Icon> اقتراحات ذكية</span><h1>قد يعجبك أيضًا</h1><p>اقتراحات قريبة من اختياراتك، ويمكنك تجاهلها بالكامل.</p></header><div className="mp-suggestion-list">{suggestions.map((item, index) => <button key={item.id} onClick={() => onToggle(item.id)} className={selected.includes(item.id) ? "selected" : ""}><span className="mp-suggest-no">0{index + 1}</span><span><b>{item.label}</b><small>{index === 0 ? "يتقاطع مع أكثر من اهتمام اخترته" : "يوسّع تجربتك بموضوع قريب"}</small></span><span className="mp-check">{selected.includes(item.id) ? "✓" : "+"}</span></button>)}</div><div className="mp-ai-note">هذه اقتراحات آلية مساندة. لا تُضاف إلا باختيارك، ولا تستبدل الحكم التحريري.</div><footer><button className="mp-secondary" onClick={onBack}>رجوع</button><button className="mp-primary" onClick={onContinue}>تأكيد اختياراتي</button></footer></section>;
}

function Ready({ name, count, onContinue }: { name: string; count: number; onContinue: () => void }) {
  return <section className="mp-ready"><div className="mp-ready-mark"><span>✓</span></div><span className="mp-kicker">جاهزون يا {name}</span><h1>جهّزنا العلم لك</h1><p>{count ? `رتّبنا البداية حول ${count} اهتمامات اخترتها، مع مساحة دائمة للاكتشاف.` : "ستبدأ بترشيحات المحررين والأكثر أهمية، ويمكنك اختيار اهتماماتك لاحقًا."}</p><div className="mp-ready-strip">{prototypeInterests.slice(0, Math.max(3, count)).map((item) => <span key={item.id}>{item.label}</span>)}</div><button className="mp-primary" onClick={onContinue}>افتح صفحتي <Icon>←</Icon></button><small>يمكنك تعديل كل شيء من حسابك</small></section>;
}

function Feed({ name, stories, isNew, aiDown, slow, onStory, onInterests }: { name: string; stories: PrototypeStory[]; isNew: boolean; aiDown: boolean; slow: boolean; onStory: (s: PrototypeStory) => void; onInterests: () => void }) {
  if (!stories.length) return <EmptyState onInterests={onInterests} />;
  return <section className="mp-feed mp-wrap">{slow && <div className="mp-status-note">الاتصال ضعيف — نعرض نسخة خفيفة من الصفحة، وقد تتأخر الصور.</div>}{aiDown && <div className="mp-status-note">التوصيات الذكية غير متاحة مؤقتًا. نعرض اختيارات المحررين والأحدث.</div>}<header className="mp-feed-head"><div><span className="mp-kicker">صفحتك في العلم</span><h1>{isNew ? "بداية منتقاة لك" : `صباح المعرفة، ${name}`}</h1><p>{isNew ? "اختر اهتماماتك لتحسين الترتيب، أو ابدأ من أهم مواد اليوم." : "مواد اختيرت من اهتماماتك، مع إضافات يوصي بها محررو العلم."}</p></div><button className="mp-tune" onClick={onInterests}><Icon>☷</Icon> اضبط اهتماماتك</button></header><div className="mp-feed-grid"><button className="mp-lead" onClick={() => onStory(stories[0])}><Image src={stories[0].image} alt="" fill sizes="(max-width: 900px) 100vw, 62vw" priority unoptimized /><span className="mp-card-overlay"><em>{stories[0].section} · {stories[0].format}</em><strong>{stories[0].title}</strong><small>{stories[0].minutes} دقائق</small></span></button><div className="mp-side-cards">{stories.slice(1, 3).map((item) => <StoryCard key={item.id} story={item} onClick={() => onStory(item)} />)}</div></div><div className="mp-section-title"><span>لأنك مهتم</span><small>ترتيب واضح ومتنوّع، لا سيل لا ينتهي</small></div><div className="mp-card-grid">{stories.slice(3).map((item) => <StoryCard key={item.id} story={item} onClick={() => onStory(item)} />)}</div></section>;
}

function StoryCard({ story, onClick }: { story: PrototypeStory; onClick: () => void }) {
  return <button className="mp-story-card" onClick={onClick}><span className="mp-story-image"><Image src={story.image} alt="" fill sizes="(max-width: 560px) 42vw, 260px" unoptimized /></span><span><em>{story.section} · {story.format}</em><strong>{story.title}</strong><small>{story.minutes} دقائق قراءة</small></span></button>;
}

function EmptyState({ onInterests }: { onInterests: () => void }) {
  return <section className="mp-empty"><div className="mp-empty-art">◎</div><h1>لا توجد مواد مناسبة الآن</h1><p>لم نجد ما يطابق اختياراتك بالجودة المطلوبة. لن نملأ صفحتك بمواد بعيدة عنك.</p><button className="mp-primary" onClick={onInterests}>وسّع اهتماماتي</button><button className="mp-link">شاهد اختيارات المحررين</button></section>;
}

function Story({ story, saved, reasonOpen, onReason, onSave, onBack }: { story: PrototypeStory; saved: boolean; reasonOpen: boolean; onReason: () => void; onSave: () => void; onBack: () => void }) {
  return <article className="mp-article mp-wrap"><button className="mp-back" onClick={onBack}>→ رجوع إلى صفحتي</button><div className="mp-article-grid"><div><span className="mp-kicker">{story.section} · {story.format}</span><h1>{story.title}</h1><p className="mp-deck">{story.excerpt}</p><div className="mp-meta"><span>{story.minutes} دقائق قراءة</span><button onClick={onSave} className={saved ? "saved" : ""}>{saved ? "✓ محفوظ" : "♡ احفظ المادة"}</button></div><button className="mp-why" onClick={onReason}><Icon>✦</Icon><span><b>لماذا ظهرت لي؟</b><small>{reasonOpen ? story.reason : "اعرف كيف رتبنا هذه المادة في صفحتك"}</small></span><Icon>{reasonOpen ? "⌃" : "⌄"}</Icon></button><div className="mp-article-body"><p>تبدأ الحكاية من سؤال بسيط، لكن الإجابة تحتاج إلى فصل الادعاء عن الدليل، وقراءة السياق قبل الوصول إلى نتيجة.</p><h2>ما الذي نعرفه؟</h2><p>يرتب محررو العلم الحقائق الأهم، ويشرحون ما تعنيه بلغة واضحة. التخصيص يغيّر ترتيب المواد فقط؛ ولا يغيّر متن المادة أو معايير النشر.</p><blockquote>اهتماماتك تساعدنا في ترتيب البداية، لكن القرار التحريري يبقى بشريًا ومستقلًا.</blockquote></div></div><span className="mp-article-image"><Image src={story.image} alt="صورة توضيحية للمادة" fill sizes="(max-width: 900px) 100vw, 42vw" unoptimized /></span></div></article>;
}

function Account({ name, selected, saved, personalization, onToggle, onInterests, onBack }: { name: string; selected: string[]; saved: number; personalization: boolean; onToggle: () => void; onInterests: () => void; onBack: () => void }) {
  return <section className="mp-account mp-wrap"><button className="mp-back" onClick={onBack}>→ رجوع إلى صفحتي</button><header><div className="mp-avatar large">{name.slice(0, 1)}</div><div><span className="mp-kicker">حسابي</span><h1>{name}</h1><p>عضو في العلم منذ اليوم</p></div></header><div className="mp-account-grid"><div className="mp-account-card"><h2>اهتماماتي <span>{selected.length}</span></h2><div className="mp-tags">{prototypeInterests.filter((item) => selected.includes(item.id)).map((item) => <span key={item.id}>{item.label}</span>)}</div><button className="mp-secondary" onClick={onInterests}>تعديل الاهتمامات</button></div><div className="mp-account-card"><h2>مكتبتي</h2><div className="mp-stat"><strong>{saved}</strong><span>مواد محفوظة</span></div><button className="mp-secondary">عرض المحفوظات</button></div><div className="mp-account-card mp-privacy"><h2>الخصوصية والتخصيص</h2><div className="mp-switch-row"><span><b>تخصيص صفحتي</b><small>استخدام اختياراتك وإشارات القراءة لترتيب المحتوى</small></span><button type="button" aria-label="تخصيص صفحتي" role="switch" aria-checked={personalization} className={personalization ? "on" : ""} onClick={onToggle}><i /></button></div><button className="mp-danger-link">مسح الإشارات المستنتجة</button><small>لن نحذف الاهتمامات التي اخترتها صراحة.</small></div></div></section>;
}

function ScenarioBanner({ scenario, onReset, onSignup }: { scenario: Scenario; onReset: () => void; onSignup: () => void }) {
  const expired = scenario === "expired";
  return <div className={`mp-scenario ${expired ? "urgent" : ""}`} role="status"><span>{expired ? "انتهت جلستك لحماية حسابك. سجّل الدخول للمتابعة." : "أنت الآن تعاين حالة استثنائية في النموذج."}</span>{expired && <button onClick={onSignup}>تسجيل الدخول</button>}<button onClick={onReset}>إغلاق</button></div>;
}
