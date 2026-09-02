import { LockIcon } from "lucide-react";

import { Card } from "@/components/ui/card";

/** شاشة بلا صلاحية — تظهر لمن وصل بالرابط مباشرة؛ الشريط الجانبي يخفي البند أصلًا. */
export function Forbidden({ title, permission }: { title: string; permission: string }) {
  return (
    <main className="flex flex-col gap-3">
      <h1 className="font-display text-xl font-extrabold">{title}</h1>
      <Card className="grid place-items-center gap-2 px-4 py-10 text-center">
        <LockIcon className="size-6 text-muted-foreground" />
        <p className="text-sm">ليست لديك صلاحية هذه الشاشة.</p>
        <p className="text-xs text-muted-foreground">
          الصلاحية المطلوبة: <code dir="ltr" className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{permission}</code> — اطلبها من مسؤول النظام.
        </p>
      </Card>
    </main>
  );
}
