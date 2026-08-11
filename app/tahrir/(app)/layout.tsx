import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/tahrir/auth";
import { promoteDueScheduled, statusCounts } from "@/lib/tahrir/service";
import { LogoutButton, MenuButton, NavBackdrop, SideNav } from "../_components/side-nav";

const ROLE_LABELS: Record<string, string> = {
  editor: "محرر",
  approver: "معتمد",
  chief: "رئيس التحرير",
};

export default async function TahrirAppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  if (!session) redirect("/tahrir/login");

  await promoteDueScheduled().catch(() => 0);
  const counts = await statusCounts().catch(() => ({}) as Record<string, number>);
  const reviewCount = counts.review ?? 0;
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  const today = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="th-app">
      <aside className="th-side">
        <div className="th-brand">
          <div className="w">العلم</div>
          <div className="t">المعرفة بسلاسة</div>
          <span className="badge">تحرير العلم · لوحة التحكم</span>
        </div>
        <SideNav reviewCount={reviewCount} total={total} />
        <div className="th-user">
          <div className="av">{session.displayName.slice(0, 1)}</div>
          <div>
            <div className="nm">{session.displayName}</div>
            <div className="rl">{ROLE_LABELS[session.role] ?? session.role}</div>
          </div>
          <LogoutButton />
        </div>
      </aside>
      <NavBackdrop />
      <div className="th-main">
        <div className="th-top">
          <MenuButton />
          <div className="th-crumb">
            تحرير العلم
            <small>{today}</small>
          </div>
          <Link className="th-new" href="/tahrir/editor/new">
            + مادة جديدة
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
