import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { memberAuth, memberAuthConfigured } from "@/lib/membership/auth";
import { getMemberProfile } from "@/lib/membership/profile";
import { seedContentProvider, sectionName } from "@/lib/content/provider";
import { storyHref, type Story } from "@/lib/content/types";
import "./for-you.css";

export const metadata: Metadata = { title: "لك", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

function score(story: Story, keys: string[]) {
  const haystack = `${story.section} ${story.title} ${story.excerpt} ${(story.keywords ?? []).join(" ")}`.toLowerCase();
  return keys.reduce((total, key) => total + (haystack.includes(key.toLowerCase()) ? 3 : 0), 0) + (story.image ? 1 : 0);
}

export default async function ForYouPage() {
  if (!memberAuthConfigured) redirect("/join");
  const { data } = await memberAuth.getSession().catch(() => ({ data: null }));
  if (!data?.user) redirect("/join");
  const profile = await getMemberProfile(data.user.id);
  if (!profile.onboardingCompleted) redirect("/welcome");
  const all = await seedContentProvider.listAll();
  const keys = profile.interests.flatMap((item) => item.contentKeys);
  const stories = [...all].sort((a, b) => score(b, keys) - score(a, keys) || (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")).slice(0, 9);
  const name = (data.user.name || "صديق العلم").split(" ")[0];

  return <><SiteHeader /><main className="fy-wrap"><header className="fy-head"><div><span>صفحتك في العلم</span><h1>صباح المعرفة، {name}</h1><p>مواد رتّبناها من اهتماماتك، مع مساحة دائمة لاختيارات المحررين والاكتشاف.</p></div><Link href="/welcome">اضبط اهتماماتك</Link></header><div className="fy-tags">{profile.interests.map((item) => <span key={item.id}>{item.label}</span>)}</div>{stories[0] && <section className="fy-lead"><div>{stories[0].image && <Image src={stories[0].image} alt="" fill sizes="(max-width:800px) 100vw,60vw" />}</div><article><span>{sectionName(stories[0].section)}</span><h2><Link href={storyHref(stories[0])}>{stories[0].title}</Link></h2><p>{stories[0].excerpt}</p><small>ظهر لك لأنه يلتقي مع اهتماماتك المختارة.</small></article></section>}<section className="fy-grid">{stories.slice(1).map((story) => <article key={story.id}>{story.image && <div><Image src={story.image} alt="" fill sizes="300px" /></div>}<span>{sectionName(story.section)}</span><h2><Link href={storyHref(story)}>{story.title}</Link></h2><small>لماذا ظهر لك؟ لأنه قريب من اهتماماتك أو من اختيارات المحررين.</small></article>)}</section></main><SiteFooter /></>;
}
