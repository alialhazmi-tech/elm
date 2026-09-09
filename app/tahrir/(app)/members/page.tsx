import Link from "next/link";
import { AudienceTable } from "@/components/tahrir/audience-table";
import { requireScreen } from "@/lib/tahrir/screen";
import { listAudience, type AudienceFilters } from "@/lib/membership/admin";
export const metadata = { title: "الأعضاء" };
export const dynamic = "force-dynamic";
export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<AudienceFilters>;
}) {
  const gate = await requireScreen("users.view", "الأعضاء");
  if (!gate.ok) return gate.element;
  const result = await listAudience(await searchParams).catch(() => null);
  if (!result)
    return (
      <main className="rounded-xl border bg-card p-6">
        <h1 className="font-display text-xl font-bold">الأعضاء</h1>
        <p role="alert" className="my-4">
          تعذر تحميل أعضاء الجمهور الآن. أعد المحاولة.
        </p>
        <Link href="/tahrir/members" className="underline">
          إعادة المحاولة
        </Link>
      </main>
    );
  const { counts, members, q, status, verified, page, pages } = result;
  function pageHref(value: number) {
    return `/tahrir/members?${new URLSearchParams({ q, status, verified, page: String(value) })}`;
  }
  return (
    <main className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold">الأعضاء</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            حسابات جمهور العلم وحالة العضوية وتوثيق البريد.
          </p>
        </div>
        <Link
          className="text-sm underline underline-offset-4"
          href="/tahrir/admin-accounts"
        >
          الحسابات الإدارية
        </Link>
      </div>
      <form
        className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/20 p-4"
        action="/tahrir/members"
      >
        <label className="grid gap-2 text-xs font-semibold">
          البحث بالاسم أو البريد
          <input
            name="q"
            defaultValue={q}
            maxLength={100}
            placeholder="ابحث عن عضو…"
            className="h-9 w-64 max-w-full rounded-md border bg-card px-3 text-sm"
          />
        </label>
        <label className="grid gap-2 text-xs font-semibold">
          حالة الحساب
          <select
            name="status"
            defaultValue={status}
            className="h-9 rounded-md border bg-card px-3 text-sm"
          >
            <option value="all">كل الحالات</option>
            <option value="active">فعّال</option>
            <option value="suspended">معلّق</option>
          </select>
        </label>
        <label className="grid gap-2 text-xs font-semibold">
          البريد الإلكتروني
          <select
            name="verified"
            defaultValue={verified}
            className="h-9 rounded-md border bg-card px-3 text-sm"
          >
            <option value="all">الكل</option>
            <option value="yes">موثّق</option>
            <option value="no">غير موثّق</option>
          </select>
        </label>
        <button className="h-9 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">
          بحث
        </button>
        {(q || status !== "all" || verified !== "all") && (
          <Link href="/tahrir/members" className="p-2 text-sm underline">
            مسح الفلاتر
          </Link>
        )}
      </form>
      <p className="text-sm text-muted-foreground">
        {counts.total} عضوًا ضمن النتائج · {counts.verified} بريد موثّق ·{" "}
        {counts.suspended} حساب معلّق
      </p>
      <AudienceTable
        members={members}
        canSuspend={gate.actor.can("users.suspend")}
      />
      {pages > 1 && (
        <nav
          aria-label="صفحات الأعضاء"
          className="flex items-center justify-between text-sm"
        >
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              className="rounded border px-4 py-2"
            >
              السابق
            </Link>
          ) : (
            <span />
          )}
          <span>
            الصفحة {page} من {pages}
          </span>
          {page < pages ? (
            <Link
              href={pageHref(page + 1)}
              className="rounded border px-4 py-2"
            >
              التالي
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </main>
  );
}
