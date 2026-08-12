import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { memberAuth, memberAuthConfigured } from "@/lib/membership/auth";
import { getMemberProfile } from "@/lib/membership/profile";
import { forYouForMember } from "@/lib/personalization/recommend";
import "./for-you.css";

export const metadata: Metadata = { title: "لك", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ForYouPage() {
  if (!memberAuthConfigured) redirect("/join");
  const { data } = await memberAuth.getSession().catch(() => ({ data: null }));
  if (!data?.user) redirect("/join");
  const profile = await getMemberProfile(data.user.id);
  if (!profile.onboardingCompleted) redirect("/welcome");
  const stories = await forYouForMember(data.user.id, 9);
  const name = (data.user.name || "صديق العلم").split(" ")[0];
  const lead = stories[0];

  return (
    <>
      <SiteHeader />
      <main className="fy-wrap">
        <header className="fy-head">
          <div>
            <span>صفحتك في العلم</span>
            <h1>صباح المعرفة، {name}</h1>
            <p>مواد رتّبناها من اهتماماتك، مع مساحة دائمة لاختيارات المحررين والاكتشاف.</p>
          </div>
          <Link href="/welcome">اضبط اهتماماتك</Link>
        </header>
        <div className="fy-tags">{profile.interests.map((item) => <span key={item.id}>{item.label}</span>)}</div>
        {lead ? (
          <section className="fy-lead">
            <div>{lead.image ? <Image src={lead.image} alt="" fill sizes="(max-width:800px) 100vw,60vw" /> : null}</div>
            <article>
              <span>{lead.sectionLabel}</span>
              <h2><Link href={lead.href}>{lead.title}</Link></h2>
              <p>{lead.excerpt}</p>
              <small>{lead.reason?.text ?? "ظهر لك لأنه يلتقي مع اهتماماتك المختارة."}</small>
            </article>
          </section>
        ) : null}
        <section className="fy-grid">
          {stories.slice(1).map((story) => (
            <article key={story.id}>
              {story.image ? <div><Image src={story.image} alt="" fill sizes="300px" /></div> : null}
              <span>{story.sectionLabel}</span>
              <h2><Link href={story.href}>{story.title}</Link></h2>
              <small>لماذا ظهر لك؟ {story.reason?.text ?? "لأنه قريب من اهتماماتك أو من اختيارات المحررين."}</small>
            </article>
          ))}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
