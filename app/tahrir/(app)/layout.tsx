import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/tahrir/app-sidebar";
import { SiteHeader } from "@/components/tahrir/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { loadActor } from "@/lib/tahrir/access";
import { promoteDueScheduled, statusCounts } from "@/lib/tahrir/service";

export default async function TahrirAppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // الفاعل يُحلّ من القاعدة عند كل طلب: التعليق وتغيير الدور يسريان فورًا، والرمز يحمل الهوية فقط.
  const actor = await loadActor();
  if (!actor) redirect("/tahrir/login");
  if (actor.mustChangePassword) redirect("/tahrir/password");

  // النشر التلقائي هنا يبطل نفسه خلال 300 ثانية عبر ISR — الإبطال الفوري في /api/tahrir/tick فقط
  // (revalidatePath يرفض العمل أثناء رندر مكوّن خادم مثل هذا الـlayout).
  await promoteDueScheduled().catch(() => []);
  const counts = await statusCounts().catch(() => ({}) as Record<string, number>);
  const total = Object.entries(counts).reduce(
    (sum, [key, value]) => (key === "archived" ? sum : sum + value),
    0,
  );

  const store = await cookies();
  const sidebarState = store.get("sidebar_state")?.value;
  const defaultOpen = sidebarState === undefined || sidebarState === "true";

  const today = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      style={
        {
          "--sidebar-width": "16rem",
          "--header-height": "3.5rem",
          "--content-padding": "1.5rem",
        } as React.CSSProperties
      }
    >
      {/* بلا Suspense حول الشريط والهيدر: الترطيب الانتقائي يؤخّر الحدود المعلّقة فيهيدرها العميل بعد أن
          يصير isMobile صحيحًا على الجوال، فيرسم الدُرج حيث رسم الخادم الشريط المكتبي — تعارض ترطيب. */}
      <AppSidebar
        user={{
          displayName: actor.displayName,
          roleLabel: actor.roleLabel,
          permissions: [...actor.permissions],
        }}
        counts={{ total, review: counts.review ?? 0, scheduled: counts.scheduled ?? 0 }}
      />
      <SidebarInset>
        <SiteHeader today={today} />
        <div className="@container/main flex flex-1 flex-col p-4 md:p-(--content-padding) xl:group-data-[theme-content-layout=centered]/layout:mx-auto xl:group-data-[theme-content-layout=centered]/layout:w-full xl:group-data-[theme-content-layout=centered]/layout:max-w-7xl">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
