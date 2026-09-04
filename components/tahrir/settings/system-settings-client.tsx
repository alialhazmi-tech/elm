"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, ShieldCheckIcon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";

import { Panel } from "@/components/tahrir/overview/panel";
import { Switch } from "@/components/ui/switch";
import type { GuardControls } from "@/lib/policy";

function SettingRow({
  title,
  description,
  checked,
  disabled,
  icon: Icon,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  icon: typeof ShieldCheckIcon;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 border-b px-4 py-4 last:border-0">
      <span className="mt-0.5 grid size-9 place-items-center rounded-lg bg-primary/10 text-primary" aria-hidden>
        <Icon className="size-4.5" />
      </span>
      <div className="min-w-0">
        <div className="font-display text-sm font-bold">{title}</div>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} aria-label={title} />
    </div>
  );
}

export function SystemSettingsClient({ initial, canEdit }: { initial: GuardControls; canEdit: boolean }) {
  const router = useRouter();
  const [controls, setControls] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function update(key: keyof GuardControls, checked: boolean) {
    if (!canEdit || busy) return;
    const previous = controls;
    const next = { ...controls, [key]: checked };
    setControls(next);
    setBusy(true);

    const response = await fetch("/api/tahrir/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ governance: next }),
    }).catch(() => null);
    const data = await response?.json().catch(() => null);
    setBusy(false);

    if (!response?.ok || !data?.governance) {
      setControls(previous);
      toast.error(data?.error ?? "تعذر حفظ إعدادات النظام.");
      return;
    }

    setControls(data.governance);
    toast.success("حُفظ إعداد النظام وبدأ تطبيقه.");
    router.refresh();
  }

  const disabledCount = Number(!controls.editorialGuard) + Number(!controls.requireImageRights);

  return (
    <div className="grid gap-3" dir="rtl">
      <Panel title="بوابات النشر">
        <SettingRow
          title="حارس السياسة التحريرية"
          description="يفحص العنوان والمتن ومخرجات الذكاء، ويمنع الإرسال أو الجدولة أو النشر عند وجود مخالفة قاطعة. الاعتماد البشري يبقى مطلوبًا في كل الحالات."
          checked={controls.editorialGuard}
          disabled={!canEdit || busy}
          icon={ShieldCheckIcon}
          onCheckedChange={(checked) => void update("editorialGuard", checked)}
        />
        <SettingRow
          title="اشتراط توثيق حقوق الصورة"
          description="يمنع إرسال أو جدولة أو نشر مادة تحمل صورة غير موسومة في مكتبة الوسائط بأنها موثقة الحقوق. يعمل هذا الشرط مستقلًا عن حارس السياسة."
          checked={controls.requireImageRights}
          disabled={!canEdit || busy}
          icon={ImageIcon}
          onCheckedChange={(checked) => void update("requireImageRights", checked)}
        />
      </Panel>

      {disabledCount > 0 ? (
        <div className="flex items-start gap-2 rounded-lg border border-(--t-warn)/30 bg-(--t-warn-bg) px-4 py-3 text-xs leading-relaxed text-(--t-warn)">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {disabledCount === 2
              ? "بوابتا السياسة وحقوق الصور معطّلتان؛ ستبقى صلاحية النشر والاعتماد البشري فقط."
              : "إحدى بوابات النشر معطّلة؛ البوابة الأخرى ما زالت تُفرض من الخادم."}
          </span>
        </div>
      ) : null}

      {!canEdit ? <p className="text-xs text-muted-foreground">يمكنك الاطلاع فقط؛ التعديل يتطلب صلاحية إعدادات النظام.</p> : null}
    </div>
  );
}
