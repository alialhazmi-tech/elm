import { cookies } from "next/headers";

import { AppSidebar } from "@/components/tahrir/app-sidebar";
import { NavigationFeedback } from "@/components/tahrir/navigation-feedback";
import { SiteHeader } from "@/components/tahrir/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { Actor } from "@/lib/tahrir/access";
import { statusCounts } from "@/lib/tahrir/service";

/**
 * هيكل اللوحة (الشريط الجانبي + الهيدر + الحاوية) لمجموعتي (app) و(account):
 * الأولى تُحوّل من عليه تفعيل التحقق بخطوتين إلى «أمان الحساب»، والثانية تستقبله هناك بالهيكل نفسه.
 */
export async function AppShell({ actor, children }: Readonly<{ actor: Actor; children: React.ReactNode }>) {
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
          avatarUrl: actor.avatarUrl,
          roleLabel: actor.roleLabel,
          permissions: [...actor.permissions],
        }}
        counts={{ total, review: counts.review ?? 0, scheduled: counts.scheduled ?? 0 }}
      />
      <SidebarInset>
        <NavigationFeedback />
        <SiteHeader actorId={actor.userId} permissions={[...actor.permissions]} today={today} user={{ name: actor.displayName, image: actor.avatarUrl }} />
        <div data-tahrir-content className="@container/main flex flex-1 flex-col p-4 md:p-(--content-padding) xl:group-data-[theme-content-layout=centered]/layout:mx-auto xl:group-data-[theme-content-layout=centered]/layout:w-full xl:group-data-[theme-content-layout=centered]/layout:max-w-7xl">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
