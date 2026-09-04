/** محتوى فقط؛ يبقى الهيدر والشريط الجانبي تفاعليين أثناء التنقل. */
export default function Loading() {
  return (
    <main className="flex flex-col gap-4" aria-busy="true" aria-label="تحميل لوحة التحكم" dir="rtl">
      <p role="status" className="text-sm text-muted-foreground">جارٍ تحميل البيانات…</p>
      <div aria-hidden="true" className="space-y-4 motion-safe:animate-pulse">
        <div className="h-7 w-40 rounded-md bg-muted" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map(item => <div key={item} className="h-24 rounded-xl border bg-card" />)}
        </div>
        <div className="divide-y rounded-xl border bg-card px-4">
          {[0, 1, 2, 3, 4, 5].map(item => <div key={item} className="flex h-16 items-center gap-4"><div className="h-4 w-1/2 rounded bg-muted" /><div className="ms-auto h-4 w-16 rounded bg-muted" /></div>)}
        </div>
      </div>
    </main>
  );
}
