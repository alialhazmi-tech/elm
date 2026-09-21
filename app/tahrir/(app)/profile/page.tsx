import Link from "next/link";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { loadActor } from "@/lib/tahrir/access";
import { AvatarUpload } from "@/components/avatar-upload";
import { EditorProfileForm } from "@/components/tahrir/editor-profile-form";
export const metadata = { title: "ملفي الشخصي" };
export const dynamic = "force-dynamic";
export default async function ProfilePage() {
  const actor = await loadActor();
  const db = getDb();
  if (!actor || !db) return null;
  const [user] = await db
    .select({
      email: users.email,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .where(eq(users.id, actor.userId))
    .limit(1);
  if (!user) return null;
  const date = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
          dateStyle: "medium",
          timeZone: "Asia/Riyadh",
        }).format(new Date(value))
      : "—";
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold">ملفي الشخصي</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          بياناتك وصورتك في تحرير العلم.
        </p>
      </div>
      <section className="rounded-xl border bg-card p-5 sm:p-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold">
            {actor.displayName}
          </h2>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
            {actor.roleLabel}
          </span>
        </div>
        <AvatarUpload
          name={actor.displayName}
          image={actor.avatarUrl}
          endpoint="/api/tahrir/account/profile"
        />
        <div className="my-6 border-t" />
        <EditorProfileForm name={actor.displayName} />
        <dl className="mt-7 grid gap-5 text-sm sm:grid-cols-2">
          {[
            ["اسم المستخدم", actor.username],
            ["البريد الإلكتروني", user.email || "غير مضاف"],
            ["تاريخ الانضمام", date(user.createdAt)],
            ["آخر دخول", date(user.lastLoginAt)],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="mt-1 break-words font-medium">
                <bdi dir="auto">{value}</bdi>
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-5">
        <div>
          <h2 className="font-display font-bold">المواد المحفوظة</h2>
          <p className="mt-1 text-sm text-muted-foreground">مكتبتك الخاصة للمواد التي حفظتها بحسابك الإداري.</p>
        </div>
        <Link className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted" href="/tahrir/profile/saved">عرض المحفوظات</Link>
      </section>
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-5">
        <div>
          <h2 className="font-display font-bold">أمان الحساب</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            إدارة كلمة المرور والتحقق بخطوتين.
          </p>
        </div>
        <Link
          className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted"
          href="/tahrir/security"
        >
          إعدادات الأمان
        </Link>
      </section>
    </main>
  );
}
